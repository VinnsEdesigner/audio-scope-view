// Real (cpal) audio capture backend. The ring-buffer inspection methods
// (`len`/`is_empty`/`has_overflow`), the per-device constructors, and the full
// `CaptureError` enum are the public capture API surface, kept even though the
// headless test/CI host has no input device to exercise every path.
#![allow(dead_code)]

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, Stream};

use crate::domain::trait_audio_capture::{AudioCapture, AudioDevice};
use crate::domain::{DomainError, DomainResult};

const DEFAULT_BUFFER_SIZE: usize = 44100 * 2;

const MAX_BUFFER_SIZE: usize = 44100 * 60;
#[derive(Debug, Clone)]
pub enum CaptureError {
    DeviceDisconnected,
    BufferOverflow,
    StreamError(String),
    ThreadPanicked,
}

impl std::fmt::Display for CaptureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CaptureError::DeviceDisconnected => write!(f, "Audio device disconnected"),
            CaptureError::BufferOverflow => write!(f, "Audio buffer overflow - samples dropped"),
            CaptureError::StreamError(e) => write!(f, "Stream error: {}", e),
            CaptureError::ThreadPanicked => write!(f, "Capture thread panicked"),
        }
    }
}

impl std::error::Error for CaptureError {}

struct AudioRingBuffer {
    buffer: Mutex<Vec<f32>>,
    // Monotonic head/tail counters (never masked on store; only masked when
    // indexing the storage). This keeps full vs. empty unambiguous (the count
    // is the difference) and makes wraparound correct — unlike masking the
    // counters themselves, which loses the high bits and breaks the count once
    // the indices wrap past `capacity`.
    write_pos: AtomicUsize,
    read_pos: AtomicUsize,
    capacity: usize,
}

impl AudioRingBuffer {
    fn new(capacity: usize) -> Self {
        let capacity = capacity.next_power_of_two();
        Self {
            buffer: Mutex::new(vec![0.0f32; capacity]),
            write_pos: AtomicUsize::new(0),
            read_pos: AtomicUsize::new(0),
            capacity,
        }
    }

    fn push(&self, data: &[f32]) -> usize {
        let write_pos = self.write_pos.load(Ordering::SeqCst);
        let read_pos = self.read_pos.load(Ordering::SeqCst);

        let len = write_pos.wrapping_sub(read_pos);
        let free = self.capacity.saturating_sub(len);
        let to_write = data.len().min(free);
        if to_write == 0 {
            return 0;
        }

        let mask = self.capacity - 1;
        let mut buffer = self.buffer.lock().unwrap();
        for i in 0..to_write {
            buffer[(write_pos.wrapping_add(i)) & mask] = data[i];
        }

        self.write_pos
            .store(write_pos.wrapping_add(to_write), Ordering::SeqCst);

        to_write
    }

    fn drain(&self, output: &mut [f32]) -> usize {
        let write_pos = self.write_pos.load(Ordering::SeqCst);
        let read_pos = self.read_pos.load(Ordering::SeqCst);

        let len = write_pos.wrapping_sub(read_pos);
        let to_read = output.len().min(len);

        let mask = self.capacity - 1;
        let buffer = self.buffer.lock().unwrap();
        for i in 0..to_read {
            output[i] = buffer[(read_pos.wrapping_add(i)) & mask];
        }

        self.read_pos
            .store(read_pos.wrapping_add(to_read), Ordering::SeqCst);

        to_read
    }

    fn len(&self) -> usize {
        let write_pos = self.write_pos.load(Ordering::SeqCst);
        let read_pos = self.read_pos.load(Ordering::SeqCst);
        write_pos.wrapping_sub(read_pos)
    }

    fn is_empty(&self) -> bool {
        self.len() == 0
    }

    fn clear(&self) {
        self.write_pos.store(0, Ordering::SeqCst);
        self.read_pos.store(0, Ordering::SeqCst);
    }

    fn has_overflow(&self) -> bool {
        self.len() >= self.capacity
    }
}

struct CaptureState {
    buffer: Arc<AudioRingBuffer>,
    stop_signal: Arc<AtomicBool>,
    running: Arc<AtomicBool>,
    error_sender: Mutex<Option<Sender<CaptureError>>>,
    dropped_samples: AtomicUsize,
}

impl CaptureState {
    fn new(buffer_size: usize) -> Self {
        let capacity = buffer_size.min(MAX_BUFFER_SIZE).next_power_of_two();
        Self {
            buffer: Arc::new(AudioRingBuffer::new(capacity)),
            stop_signal: Arc::new(AtomicBool::new(false)),
            running: Arc::new(AtomicBool::new(false)),
            error_sender: Mutex::new(None),
            dropped_samples: AtomicUsize::new(0),
        }
    }

    fn set_error_sender(&self, sender: Sender<CaptureError>) {
        *self.error_sender.lock().unwrap() = Some(sender);
    }

    fn send_error(&self, err: CaptureError) {
        if let Some(sender) = self.error_sender.lock().unwrap().as_ref() {
            let _ = sender.send(err);
        }
    }

    fn record_dropped(&self, count: usize) {
        self.dropped_samples.fetch_add(count, Ordering::Relaxed);
    }

    fn get_dropped_count(&self) -> usize {
        self.dropped_samples.load(Ordering::Relaxed)
    }
}

pub struct RealAudioCapture {
    device_id: Option<String>,
    sample_rate: u32,
    channels: u32,
    buffer_size: usize,
    state: Arc<CaptureState>,
    stream: Mutex<Option<Stream>>,
    error_receiver: Mutex<Option<Receiver<CaptureError>>>,
}

impl RealAudioCapture {
    pub fn new() -> DomainResult<Self> {
        Self::with_buffer_size(DEFAULT_BUFFER_SIZE)
    }

    pub fn with_buffer_size(buffer_size: usize) -> DomainResult<Self> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| DomainError::capture_error("No input device available"))?;

        let device_id = device.name().ok().unwrap_or_else(|| "default".to_string());

        let config = device
            .default_input_config()
            .map_err(|e| DomainError::capture_error(format!("Cannot get default config: {}", e)))?;

        let (tx, rx) = mpsc::channel();
        let state = Arc::new(CaptureState::new(buffer_size));
        state.set_error_sender(tx);

        Ok(Self {
            device_id: Some(device_id),
            sample_rate: config.sample_rate().0,
            channels: config.channels() as u32,
            buffer_size,
            state,
            stream: Mutex::new(None),
            error_receiver: Mutex::new(Some(rx)),
        })
    }

    pub fn with_device(device_id: &str) -> DomainResult<Self> {
        Self::with_device_and_buffer(device_id, DEFAULT_BUFFER_SIZE)
    }

    pub fn with_device_and_buffer(device_id: &str, buffer_size: usize) -> DomainResult<Self> {
        let host = cpal::default_host();

        let device = host
            .input_devices()
            .map_err(|e| DomainError::capture_error(format!("Cannot enumerate devices: {}", e)))?
            .find(|d| d.name().map(|n| n == device_id).unwrap_or(false))
            .ok_or_else(|| {
                DomainError::capture_error(format!("Device not found: {}", device_id))
            })?;

        let config = device
            .default_input_config()
            .map_err(|e| DomainError::capture_error(format!("Cannot get default config: {}", e)))?;

        let (tx, rx) = mpsc::channel();
        let state = Arc::new(CaptureState::new(buffer_size));
        state.set_error_sender(tx);

        Ok(Self {
            device_id: Some(device_id.to_string()),
            sample_rate: config.sample_rate().0,
            channels: config.channels() as u32,
            buffer_size,
            state,
            stream: Mutex::new(None),
            error_receiver: Mutex::new(Some(rx)),
        })
    }

    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    pub fn channels(&self) -> u32 {
        self.channels
    }

    pub fn list_devices() -> Vec<AudioDevice> {
        let host = cpal::default_host();
        let default_device = host.default_input_device();

        host.input_devices()
            .map(|devices| {
                devices
                    .filter_map(|d| {
                        d.name().ok().map(|name| {
                            let config = d.default_input_config().ok();
                            let is_default = default_device
                                .as_ref()
                                .and_then(|dd| dd.name().ok())
                                .map(|dn| dn == name)
                                .unwrap_or(false);

                            AudioDevice {
                                id: name.clone(),
                                name,
                                channels: config.as_ref().map(|c| c.channels() as u32).unwrap_or(2),
                                sample_rate: config.map(|c| c.sample_rate().0).unwrap_or(44100),
                                is_default,
                            }
                        })
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    fn get_device(&self) -> DomainResult<Device> {
        let host = cpal::default_host();

        match &self.device_id {
            Some(id) => host
                .input_devices()
                .map_err(|e| {
                    DomainError::capture_error(format!("Cannot enumerate devices: {}", e))
                })?
                .find(|d| d.name().map(|n| n == *id).unwrap_or(false))
                .ok_or_else(|| DomainError::capture_error(format!("Device not found: {}", id))),
            None => host
                .default_input_device()
                .ok_or_else(|| DomainError::capture_error("No default input device".to_string())),
        }
    }

    fn build_input_stream(
        device: &Device,
        config: &cpal::SupportedStreamConfig,
        buffer: Arc<AudioRingBuffer>,
        stop_signal: Arc<AtomicBool>,
        state: Arc<CaptureState>,
    ) -> DomainResult<Stream> {
        let sample_format = config.sample_format();
        let stream_config: cpal::StreamConfig = config.clone().into();

        let build_result = match sample_format {
            SampleFormat::F32 => {
                let buffer = buffer.clone();
                let stop = stop_signal.clone();
                let state_err = state.clone();
                let state_data = state.clone();
                device.build_input_stream(
                    &stream_config,
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        if !stop.load(Ordering::SeqCst) {
                            let written = buffer.push(data);
                            if written < data.len() {
                                state_data.record_dropped(data.len() - written);
                                state_data.send_error(CaptureError::BufferOverflow);
                            }
                        }
                    },
                    move |err| {
                        state_err.send_error(CaptureError::StreamError(err.to_string()));
                    },
                    None,
                )
            }
            SampleFormat::I16 => {
                let buffer = buffer.clone();
                let stop = stop_signal.clone();
                let state_err = state.clone();
                let state_data = state.clone();
                device.build_input_stream(
                    &stream_config,
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        if !stop.load(Ordering::SeqCst) {
                            let normalized: Vec<f32> =
                                data.iter().map(|&s| s as f32 / 32768.0).collect();
                            let written = buffer.push(&normalized);
                            if written < data.len() {
                                state_data.record_dropped(data.len() - written);
                                state_data.send_error(CaptureError::BufferOverflow);
                            }
                        }
                    },
                    move |err| {
                        state_err.send_error(CaptureError::StreamError(err.to_string()));
                    },
                    None,
                )
            }
            SampleFormat::U16 => {
                let buffer = buffer.clone();
                let stop = stop_signal.clone();
                let state_err = state.clone();
                let state_data = state.clone();
                device.build_input_stream(
                    &stream_config,
                    move |data: &[u16], _: &cpal::InputCallbackInfo| {
                        if !stop.load(Ordering::SeqCst) {
                            let normalized: Vec<f32> = data
                                .iter()
                                .map(|&s| (s as f32 - 32768.0) / 32768.0)
                                .collect();
                            let written = buffer.push(&normalized);
                            if written < data.len() {
                                state_data.record_dropped(data.len() - written);
                                state_data.send_error(CaptureError::BufferOverflow);
                            }
                        }
                    },
                    move |err| {
                        state_err.send_error(CaptureError::StreamError(err.to_string()));
                    },
                    None,
                )
            }
            _ => {
                return Err(DomainError::capture_error(format!(
                    "Unsupported sample format: {:?}",
                    sample_format
                )));
            }
        };

        build_result
            .map_err(|e| DomainError::capture_error(format!("Failed to build stream: {}", e)))
    }

    fn check_errors(&self) {
        if let Ok(receiver) = self.error_receiver.lock()
            && let Some(rx) = receiver.as_ref()
        {
            while let Ok(err) = rx.try_recv() {
                tracing::error!("Audio capture error: {}", err);
            }
        }
    }

    pub fn get_dropped_samples(&self) -> usize {
        self.state.get_dropped_count()
    }
}

impl Default for RealAudioCapture {
    fn default() -> Self {
        Self::new().expect("Failed to create default audio capture")
    }
}

impl Drop for RealAudioCapture {
    fn drop(&mut self) {
        self.state.stop_signal.store(true, Ordering::SeqCst);
        if let Ok(mut stream_guard) = self.stream.lock() {
            stream_guard.take();
        }
    }
}

unsafe impl Send for RealAudioCapture {}
unsafe impl Sync for RealAudioCapture {}

#[async_trait]
impl AudioCapture for RealAudioCapture {
    async fn start(&mut self, _device_id: Option<&str>) -> DomainResult<()> {
        if self.state.running.load(Ordering::SeqCst) {
            return Ok(());
        }

        self.check_errors();

        self.state.buffer.clear();
        self.state.stop_signal.store(false, Ordering::SeqCst);
        self.state.dropped_samples.store(0, Ordering::Relaxed);

        let device = self.get_device()?;
        let config = device
            .default_input_config()
            .map_err(|e| DomainError::capture_error(format!("Cannot get config: {}", e)))?;

        self.sample_rate = config.sample_rate().0;
        self.channels = config.channels() as u32;

        let stream = Self::build_input_stream(
            &device,
            &config,
            self.state.buffer.clone(),
            self.state.stop_signal.clone(),
            self.state.clone(),
        )?;

        stream
            .play()
            .map_err(|e| DomainError::capture_error(format!("Failed to start stream: {}", e)))?;

        *self.stream.lock().unwrap() = Some(stream);
        self.state.running.store(true, Ordering::SeqCst);

        tracing::info!(
            "Started audio capture: {} Hz, {} channels, buffer size {}",
            self.sample_rate,
            self.channels,
            self.buffer_size
        );

        Ok(())
    }

    async fn stop(&mut self) -> DomainResult<()> {
        if !self.state.running.load(Ordering::SeqCst) {
            return Ok(());
        }

        self.state.stop_signal.store(true, Ordering::SeqCst);

        *self.stream.lock().unwrap() = None;

        self.state.running.store(false, Ordering::SeqCst);

        let dropped = self.state.get_dropped_count();
        if dropped > 0 {
            tracing::warn!("Audio capture stopped with {} dropped samples", dropped);
        }

        tracing::info!("Stopped audio capture");
        Ok(())
    }

    async fn pause(&mut self) -> DomainResult<()> {
        if let Ok(stream_guard) = self.stream.lock()
            && let Some(ref stream) = *stream_guard
        {
            stream
                .pause()
                .map_err(|e| DomainError::capture_error(format!("Failed to pause: {}", e)))?;
        }
        Ok(())
    }

    async fn resume(&mut self) -> DomainResult<()> {
        if let Ok(stream_guard) = self.stream.lock()
            && let Some(ref stream) = *stream_guard
        {
            stream
                .play()
                .map_err(|e| DomainError::capture_error(format!("Failed to resume: {}", e)))?;
        }
        Ok(())
    }

    fn is_capturing(&self) -> bool {
        self.state.running.load(Ordering::SeqCst)
    }

    async fn read_samples(&mut self, buffer: &mut [f32]) -> DomainResult<u32> {
        self.check_errors();

        if !self.state.running.load(Ordering::SeqCst) {
            for sample in buffer.iter_mut() {
                *sample = 0.0;
            }
            return Ok(buffer.len() as u32);
        }

        let count = self.state.buffer.drain(buffer);

        for sample in buffer[count..].iter_mut() {
            *sample = 0.0;
        }

        Ok(count as u32)
    }

    async fn get_devices(&self) -> DomainResult<Vec<AudioDevice>> {
        Ok(Self::list_devices())
    }
}

pub fn get_host_name() -> String {
    #[cfg(target_os = "linux")]
    return "ALSA".to_string();
    #[cfg(target_os = "macos")]
    return "CoreAudio".to_string();
    #[cfg(target_os = "windows")]
    return "WASAPI".to_string();
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    return "Unknown".to_string();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ring_buffer_basic() {
        let buffer = AudioRingBuffer::new(16);

        let data = [1.0, 2.0, 3.0, 4.0];
        let written = buffer.push(&data);
        assert_eq!(written, 4);

        let mut output = [0.0f32; 4];
        let read = buffer.drain(&mut output);
        assert_eq!(read, 4);
        assert_eq!(output, [1.0, 2.0, 3.0, 4.0]);
    }

    #[test]
    fn test_ring_buffer_wrap() {
        // Capacity is a power of two (8). Pushing more than the buffer holds
        // must drop the overflow and keep the oldest samples, and a second push
        // after a partial drain must wrap the write cursor past the physical
        // end of the storage (the whole point of a ring buffer).
        let buffer = AudioRingBuffer::new(8);

        // 1) Overflow: 10 samples into a capacity-8 buffer writes exactly 8
        //    (the first 8) and drops the last 2.
        let data = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0];
        let written = buffer.push(&data);
        assert_eq!(written, 8);
        assert!(buffer.has_overflow());

        let mut output = [0.0f32; 16];
        let read = buffer.drain(&mut output);
        assert_eq!(read, 8);
        assert_eq!(&output[..8], &[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]);
        assert!(buffer.is_empty());

        // 2) Wrap: advance the cursors partway, then push across the boundary so
        //    the write physically straddles the end and start of the storage.
        buffer.push(&[10.0, 20.0, 30.0, 40.0, 50.0, 60.0]); // writes 6 samples
        let mut drained = [0.0f32; 4];
        assert_eq!(buffer.drain(&mut drained), 4); // consumes the first 4
        assert_eq!(drained, [10.0, 20.0, 30.0, 40.0]);
        // Buffer now holds [50.0, 60.0] (2 items, 6 slots free). A push that
        // straddles the physical end wraps the write cursor 6 -> 7 -> 0 -> 1 ...
        // and drops the 2 samples that don't fit (drop-on-full, matching the
        // capture path's dropped-sample accounting).
        let wrap_data = [100.0, 200.0, 300.0, 400.0, 500.0, 600.0, 700.0, 800.0];
        assert_eq!(buffer.push(&wrap_data), 6); // 6 free slots, 2 dropped
        let mut out = [0.0f32; 16];
        let n = buffer.drain(&mut out);
        assert_eq!(n, 8);
        // Oldest-first: the 2 survivors then the 6 newest that fit.
        assert_eq!(
            &out[..8],
            &[50.0, 60.0, 100.0, 200.0, 300.0, 400.0, 500.0, 600.0]
        );
    }

    #[test]
    fn test_list_devices() {
        let devices = RealAudioCapture::list_devices();
        eprintln!("Found {} audio devices", devices.len());
        for device in &devices {
            eprintln!(
                "  - {} ({} ch, {} Hz) {}",
                device.name,
                device.channels,
                device.sample_rate,
                if device.is_default { "[DEFAULT]" } else { "" }
            );
        }
    }

    #[test]
    fn test_host_name() {
        let name = get_host_name();
        eprintln!("Audio host: {}", name);
    }

    #[test]
    fn test_capture_creation() {
        let capture = RealAudioCapture::new();
        if capture.is_err() {
            eprintln!("Failed to create capture: {:?}", capture.err());
            return;
        }
        eprintln!("Created audio capture successfully");
    }
}
