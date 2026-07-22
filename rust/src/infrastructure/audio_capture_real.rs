
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::sync::mpsc::{self, Sender, Receiver};

use async_trait::async_trait;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, Stream};

use crate::domain::trait_audio_capture::{AudioCapture, AudioDevice};
use crate::domain::{DomainError, DomainResult};

/// Default buffer size in samples (~1 second at 44.1kHz)
const DEFAULT_BUFFER_SIZE: usize = 44100 * 2;

/// Maximum buffer size (prevents memory exhaustion)
const MAX_BUFFER_SIZE: usize = 44100 * 60; // 1 minute max

/// Error types for audio capture
#[derive(Debug, Clone)]
pub enum CaptureError {
    /// Device disconnected
    DeviceDisconnected,
    /// Buffer overflow (data being dropped)
    BufferOverflow,
    /// Stream error
    StreamError(String),
    /// Thread panicked
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

/// Thread-safe ring buffer for audio samples
/// Uses atomics for position tracking and Mutex for buffer access
struct AudioRingBuffer {
    buffer: Mutex<Vec<f32>>,
    write_pos: AtomicUsize,
    read_pos: AtomicUsize,
    capacity: usize,
}

impl AudioRingBuffer {
    fn new(capacity: usize) -> Self {
        let capacity = capacity.next_power_of_two(); // Ensure power of 2 for fast modulo
        Self {
            buffer: Mutex::new(vec![0.0f32; capacity]),
            write_pos: AtomicUsize::new(0),
            read_pos: AtomicUsize::new(0),
            capacity,
        }
    }

    /// Push samples into the buffer
    /// Returns number of samples actually written (may be less if buffer is full)
    fn push(&self, data: &[f32]) -> usize {
        let write_pos = self.write_pos.load(Ordering::SeqCst);
        let read_pos = self.read_pos.load(Ordering::SeqCst);
        
        // Calculate available space
        let available = if write_pos >= read_pos {
            self.capacity - (write_pos - read_pos)
        } else {
            read_pos - write_pos
        };
        
        let to_write = data.len().min(available.saturating_sub(1)); // Keep one slot empty
        if to_write == 0 {
            return 0;
        }
        
        let mut_wpos = self.write_pos.load(Ordering::SeqCst);
        let mut buffer = self.buffer.lock().unwrap();
        for (i, &sample) in data.iter().take(to_write).enumerate() {
            buffer[(mut_wpos + i) & (self.capacity - 1)] = sample;
        }
        
        // Memory barrier to ensure data is written before updating position
        self.write_pos.store((mut_wpos + to_write) & (self.capacity - 1), Ordering::SeqCst);
        
        to_write
    }

    /// Drain samples from the buffer into the provided slice
    /// Returns number of samples actually read
    fn drain(&self, output: &mut [f32]) -> usize {
        let write_pos = self.write_pos.load(Ordering::SeqCst);
        let mut read_pos = self.read_pos.load(Ordering::SeqCst);
        
        let available = if write_pos >= read_pos {
            write_pos - read_pos
        } else {
            self.capacity - read_pos + write_pos
        };
        
        let to_read = output.len().min(available);
        
        let buffer = self.buffer.lock().unwrap();
        for i in 0..to_read {
            output[i] = buffer[(read_pos + i) & (self.capacity - 1)];
        }
        
        // Memory barrier
        self.read_pos.store((read_pos + to_read) & (self.capacity - 1), Ordering::SeqCst);
        
        to_read
    }

    /// Get number of samples currently in buffer
    fn len(&self) -> usize {
        let write_pos = self.write_pos.load(Ordering::SeqCst);
        let read_pos = self.read_pos.load(Ordering::SeqCst);
        
        if write_pos >= read_pos {
            write_pos - read_pos
        } else {
            self.capacity - read_pos + write_pos
        }
    }

    /// Check if buffer is empty
    fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Clear the buffer
    fn clear(&self) {
        self.write_pos.store(0, Ordering::SeqCst);
        self.read_pos.store(0, Ordering::SeqCst);
    }

    /// Check if buffer has overflowed (data was lost)
    fn has_overflow(&self) -> bool {
        let write_pos = self.write_pos.load(Ordering::SeqCst);
        let read_pos = self.read_pos.load(Ordering::SeqCst);
        
        let available = if write_pos >= read_pos {
            write_pos - read_pos
        } else {
            self.capacity - read_pos + write_pos
        };
        
        available >= self.capacity - 1
    }
}

/// Capture state shared between main thread and capture thread
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

/// Real audio capture using cpal
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
    /// Create a new RealAudioCapture with the default input device
    pub fn new() -> DomainResult<Self> {
        Self::with_buffer_size(DEFAULT_BUFFER_SIZE)
    }

    /// Create with custom buffer size
    pub fn with_buffer_size(buffer_size: usize) -> DomainResult<Self> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| DomainError::capture_error("No input device available"))?;

        let device_id = device
            .name()
            .ok()
            .unwrap_or_else(|| "default".to_string());

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

    /// Create with a specific device ID
    pub fn with_device(device_id: &str) -> DomainResult<Self> {
        Self::with_device_and_buffer(device_id, DEFAULT_BUFFER_SIZE)
    }

    /// Create with specific device and buffer size
    pub fn with_device_and_buffer(device_id: &str, buffer_size: usize) -> DomainResult<Self> {
        let host = cpal::default_host();

        let device = host
            .input_devices()
            .map_err(|e| DomainError::capture_error(format!("Cannot enumerate devices: {}", e)))?
            .find(|d| d.name().map(|n| n == device_id).unwrap_or(false))
            .ok_or_else(|| DomainError::capture_error(format!("Device not found: {}", device_id)))?;

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

    /// Get the current sample rate
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    /// Get the number of channels
    pub fn channels(&self) -> u32 {
        self.channels
    }

    /// List all available input devices
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
                                sample_rate: config
                                    .map(|c| c.sample_rate().0)
                                    .unwrap_or(44100),
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
                .map_err(|e| DomainError::capture_error(format!("Cannot enumerate devices: {}", e)))?
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
                            let normalized: Vec<f32> = data.iter().map(|&s| s as f32 / 32768.0).collect();
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
                            let normalized: Vec<f32> = data.iter().map(|&s| (s as f32 - 32768.0) / 32768.0).collect();
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

        build_result.map_err(|e| DomainError::capture_error(format!("Failed to build stream: {}", e)))
    }

    /// Check for any errors from the capture thread
    fn check_errors(&self) {
        if let Ok(receiver) = self.error_receiver.lock() {
            if let Some(rx) = receiver.as_ref() {
                while let Ok(err) = rx.try_recv() {
                    tracing::error!("Audio capture error: {}", err);
                }
            }
        }
    }

    /// Get statistics about dropped samples
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
        // Signal stop and drop the stream
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

        // Check for any pending errors
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

        stream.play().map_err(|e| DomainError::capture_error(format!("Failed to start stream: {}", e)))?;

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
        
        // Drop the stream to stop capture
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
        if let Ok(mut stream_guard) = self.stream.lock() {
            if let Some(ref stream) = *stream_guard {
                stream.pause().map_err(|e| 
                    DomainError::capture_error(format!("Failed to pause: {}", e))
                )?;
            }
        }
        Ok(())
    }

    async fn resume(&mut self) -> DomainResult<()> {
        if let Ok(mut stream_guard) = self.stream.lock() {
            if let Some(ref stream) = *stream_guard {
                stream.play().map_err(|e| 
                    DomainError::capture_error(format!("Failed to resume: {}", e))
                )?;
            }
        }
        Ok(())
    }

    fn is_capturing(&self) -> bool {
        self.state.running.load(Ordering::SeqCst)
    }

    async fn read_samples(&mut self, buffer: &mut [f32]) -> DomainResult<u32> {
        // Check for any errors from the capture thread
        self.check_errors();

        if !self.state.running.load(Ordering::SeqCst) {
            for sample in buffer.iter_mut() {
                *sample = 0.0;
            }
            return Ok(buffer.len() as u32);
        }

        let count = self.state.buffer.drain(buffer);
        
        // Fill remaining with zeros if buffer was empty
        for sample in buffer[count..].iter_mut() {
            *sample = 0.0;
        }

        Ok(count as u32)
    }

    async fn get_devices(&self) -> DomainResult<Vec<AudioDevice>> {
        Ok(Self::list_devices())
    }
}

/// Get the default audio host name
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
        
        // Test push and drain
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
        let buffer = AudioRingBuffer::new(8);
        
        // Fill beyond capacity
        let data = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0];
        let written = buffer.push(&data);
        assert_eq!(written, 9); // One slot kept empty
        
        let mut output = [0.0f32; 16];
        let read = buffer.drain(&mut output);
        assert_eq!(read, 9);
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
