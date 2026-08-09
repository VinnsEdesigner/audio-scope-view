
#![allow(dead_code, clippy::await_holding_lock, clippy::readonly_write_lock)]

use crate::domain::fft_processor::{FftProcessor, WindowType};
use crate::domain::trait_audio_capture::AudioCapture;
use crate::shared::constants::{DEFAULT_BUFFER_SIZE, DEFAULT_SAMPLE_RATE};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::JoinHandle;
use std::time::Instant;
use tokio::sync::mpsc;
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::infrastructure::audio_capture_real::RealAudioCapture;

#[derive(Debug, Clone)]
pub enum AudioStreamEvent {
    Waveform {
        session_id: String,
        samples: Vec<f32>,
        timestamp_ms: i64,
        sample_rate: u32,
    },
    Spectrum {
        session_id: String,
        frequencies: Vec<f32>,
        magnitudes: Vec<f32>,
        timestamp_ms: i64,
    },
    DeviceDisconnected {
        session_id: String,
        reason: String,
    },
    Error {
        session_id: String,
        message: String,
    },
    CaptureStarted {
        session_id: String,
        sample_rate: u32,
    },
    CaptureStopped {
        session_id: String,
    },
}

#[derive(Debug, Clone)]
pub struct StreamConfig {
    pub session_id: String,
    pub sample_rate: u32,
    pub buffer_size: usize,
    pub enable_spectrum: bool,
    pub fft_window: WindowType,
    pub fft_size: usize,
    pub update_interval_ms: u64,
}

impl Default for StreamConfig {
    fn default() -> Self {
        Self {
            session_id: "default".to_string(),
            sample_rate: DEFAULT_SAMPLE_RATE,
            buffer_size: DEFAULT_BUFFER_SIZE as usize,
            enable_spectrum: true,
            fft_window: WindowType::Hann,
            fft_size: 1024,
            update_interval_ms: 0,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct StreamStats {
    pub bytes_captured: u64,
    pub samples_captured: u64,
    pub buffers_processed: u64,
    pub errors: u32,
    pub last_update: Option<Instant>,
    pub capture_duration_ms: u64,
}

impl StreamStats {
    fn new() -> Self {
        Self::default()
    }

    fn record_samples(&mut self, count: usize) {
        self.samples_captured += count as u64;
        self.bytes_captured += count as u64 * 4;         self.last_update = Some(Instant::now());
    }

    fn record_buffer(&mut self) {
        self.buffers_processed += 1;
    }

    fn record_error(&mut self) {
        self.errors += 1;
    }
}

struct SessionStream {
    config: StreamConfig,
    stats: StreamStats,
    running: AtomicBool,
    capture_start: Option<Instant>,
}

impl SessionStream {
    fn new(config: StreamConfig) -> Self {
        Self {
            config,
            stats: StreamStats::new(),
            running: AtomicBool::new(false),
            capture_start: None,
        }
    }
}

pub struct AudioStreamManager {
    capture: RwLock<Option<Box<dyn AudioCaptureBackend>>>,
    sessions: RwLock<HashMap<String, SessionStream>>,
    fft: RwLock<FftProcessor>,
    event_sender: RwLock<Option<mpsc::Sender<AudioStreamEvent>>>,
    task_handle: RwLock<Option<JoinHandle<()>>>,
    stop_signal: AtomicBool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum AudioBackendType {
    #[default]
    Real,
}

#[async_trait]
pub trait AudioCaptureBackend: Send + Sync {
    async fn start(&mut self, device_id: Option<&str>) -> crate::domain::DomainResult<()>;
    async fn stop(&mut self) -> crate::domain::DomainResult<()>;
    fn is_capturing(&self) -> bool;
    async fn read_samples(&mut self, buffer: &mut [f32]) -> crate::domain::DomainResult<u32>;
    async fn get_devices(&self) -> crate::domain::DomainResult<Vec<crate::domain::trait_audio_capture::AudioDevice>>;
    fn sample_rate(&self) -> u32;
}

#[async_trait]
impl AudioCaptureBackend for RealAudioCapture {
    async fn start(&mut self, device_id: Option<&str>) -> crate::domain::DomainResult<()> {
        AudioCapture::start(self, device_id).await
    }
    async fn stop(&mut self) -> crate::domain::DomainResult<()> {
        AudioCapture::stop(self).await
    }
    fn is_capturing(&self) -> bool {
        AudioCapture::is_capturing(self)
    }
    async fn read_samples(&mut self, buffer: &mut [f32]) -> crate::domain::DomainResult<u32> {
        AudioCapture::read_samples(self, buffer).await
    }
    async fn get_devices(&self) -> crate::domain::DomainResult<Vec<crate::domain::trait_audio_capture::AudioDevice>> {
        AudioCapture::get_devices(self).await
    }
    fn sample_rate(&self) -> u32 {
        RealAudioCapture::sample_rate(self)
    }
}

impl AudioStreamManager {
    pub fn new() -> Self {
        Self {
            capture: RwLock::new(None),
            sessions: RwLock::new(HashMap::new()),
            fft: RwLock::new(FftProcessor::new()),
            event_sender: RwLock::new(None),
            task_handle: RwLock::new(None),
            stop_signal: AtomicBool::new(false),
        }
    }

    pub fn with_backend(_backend: AudioBackendType) -> Self {
        // Only the cpal (Real) backend exists; the argument is accepted for
        // API compatibility but ignored.
        Self::new()
    }

    pub async fn init_capture(&self) -> crate::domain::DomainResult<()> {
        info!("Initializing real audio capture (cpal) backend");
        let capture: Box<dyn AudioCaptureBackend> = Box::new(RealAudioCapture::new().map_err(|e| {
            crate::domain::DomainError::capture_error(format!("RealAudio init failed: {:?}", e))
        })?);
        *self.capture.write().await = Some(capture);
        Ok(())
    }

    /// One-shot capture: open the cpal backend, read `duration_ms` of audio,
    /// then close it. Used by the `capture` GraphQL mutation. The streaming
    /// session registry is not touched, so this is safe to call while a
    /// streaming capture is active.
    pub async fn capture_once(&self, duration_ms: u32) -> crate::domain::DomainResult<(Vec<f32>, u32)> {
        let sample_rate = RealAudioCapture::new()
            .map(|c| c.sample_rate())
            .unwrap_or(DEFAULT_SAMPLE_RATE);

        info!("One-shot capture: real (cpal) backend");
        let mut capture: Box<dyn AudioCaptureBackend> = Box::new(RealAudioCapture::new().map_err(|e| {
            crate::domain::DomainError::capture_error(format!("RealAudio init failed: {:?}", e))
        })?);

        let num_samples = (sample_rate as usize * duration_ms as usize) / 1000;
        let num_samples = num_samples.max(1);
        let mut buffer = vec![0.0f32; num_samples];

        capture.start(None).await?;
        let read = capture.read_samples(&mut buffer).await?;
        let _ = capture.stop().await;

        // Truncate to actually-read samples (real backends may return fewer).
        let actual_rate = capture.sample_rate();
        if (read as usize) < buffer.len() && read > 0 {
            buffer.truncate(read as usize);
        }

        info!(
            "One-shot capture complete: {} samples @ {} Hz (requested {} ms)",
            buffer.len(),
            actual_rate,
            duration_ms
        );

        Ok((buffer, actual_rate))
    }

    pub async fn set_event_sender(&self, sender: mpsc::Sender<AudioStreamEvent>) {
        *self.event_sender.write().await = Some(sender);
    }

    pub async fn register_session(&self, config: StreamConfig) -> crate::domain::DomainResult<()> {
        let mut sessions = self.sessions.write().await;
        if sessions.contains_key(&config.session_id) {
            return Err(crate::domain::DomainError::invalid_operation(
                format!("Session '{}' already registered", config.session_id)
            ));
        }
        sessions.insert(config.session_id.clone(), SessionStream::new(config));
        Ok(())
    }

    pub async fn unregister_session(&self, session_id: &str) -> bool {
        let mut sessions = self.sessions.write().await;
        sessions.remove(session_id).is_some()
    }

    pub async fn get_session_config(&self, session_id: &str) -> Option<StreamConfig> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).map(|s| s.config.clone())
    }

    pub async fn get_session_stats(&self, session_id: &str) -> Option<StreamStats> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).map(|s| s.stats.clone())
    }

    pub async fn start_capture(&self, session_id: &str) -> crate::domain::DomainResult<()> {
        let needs_register = {
            let sessions = self.sessions.read().await;
            !sessions.contains_key(session_id)
        };

        if needs_register {
            let config = StreamConfig {
                session_id: session_id.to_string(),
                ..Default::default()
            };
            self.register_session(config).await?;
        }

        let mut capture_guard = self.capture.write().await;
        if let Some(capture) = capture_guard.as_mut()
            && !capture.is_capturing() {
                capture.start(None).await?;
            }
        drop(capture_guard);

        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(session_id) {
            session.running.store(true, Ordering::SeqCst);
            session.capture_start = Some(Instant::now());
        }
        drop(sessions);

        if let Some(sender) = self.event_sender.read().await.as_ref() {
            let _ = sender.send(AudioStreamEvent::CaptureStarted {
                session_id: session_id.to_string(),
                sample_rate: DEFAULT_SAMPLE_RATE,
            }).await;
        }

        info!("Started capture for session: {}", session_id);
        Ok(())
    }

    pub async fn stop_capture(&self, session_id: &str) -> crate::domain::DomainResult<()> {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(session_id) {
            session.running.store(false, Ordering::SeqCst);
        }
        drop(sessions);

        let any_running = {
            let sessions = self.sessions.read().await;
            sessions.values().any(|s| s.running.load(Ordering::SeqCst))
        };

        if !any_running {
            let mut capture_guard = self.capture.write().await;
            if let Some(capture) = capture_guard.as_mut()
                && capture.is_capturing() {
                    capture.stop().await?;
                }
        }

        if let Some(sender) = self.event_sender.read().await.as_ref() {
            let _ = sender.send(AudioStreamEvent::CaptureStopped {
                session_id: session_id.to_string(),
            }).await;
        }

        info!("Stopped capture for session: {}", session_id);
        Ok(())
    }

    pub async fn read_and_process(&self) -> crate::domain::DomainResult<usize> {
        let mut buffer = vec![0.0f32; 4096];

        let sample_rate = {
            let capture_guard = self.capture.read().await;
            match capture_guard.as_ref() {
                Some(c) if c.is_capturing() => c.sample_rate(),
                _ => return Ok(0),
            }
        };

        {
            let mut capture_guard = self.capture.write().await;
            if let Some(capture) = capture_guard.as_mut() {
                if !capture.is_capturing() {
                    return Ok(0);
                }

                // Always read a full buffer (read_samples zero-pads when the
                // cpal ring buffer is empty, e.g. a silent monitor). Emitting
                // even zero-padded buffers guarantees subscribers receive
                // server-side metrics on every tick instead of going silent
                // when there is no audio.
                let _samples_read = capture.read_samples(&mut buffer).await?;
            }
        }

        let sessions = self.sessions.read().await;
        let mut processed = 0;

        for (session_id, session) in sessions.iter() {
            if !session.running.load(Ordering::SeqCst) {
                continue;
            }

            let mut session_stats = session.stats.clone();
            session_stats.record_samples(buffer.len());
            session_stats.record_buffer();

            if let Some(start) = session.capture_start {
                session_stats.capture_duration_ms = start.elapsed().as_millis() as u64;
            }

            if let Some(sender) = self.event_sender.read().await.as_ref() {
                let timestamp_ms = chrono::Utc::now().timestamp_millis();

                let event = AudioStreamEvent::Waveform {
                    session_id: session_id.clone(),
                    samples: buffer.clone(),
                    timestamp_ms,
                    sample_rate,
                };

                if sender.send(event).await.is_err() {
                    warn!("Failed to send waveform event for session {}", session_id);
                }
                processed += 1;
            }

            if session.config.enable_spectrum && buffer.len() >= session.config.fft_size {
                let mut fft = self.fft.write().await;
                let spectrum = fft.compute_spectrum(
                    &buffer[..session.config.fft_size],
                    sample_rate as f32,
                    session.config.fft_window,
                );

                if let Some(sender) = self.event_sender.read().await.as_ref() {
                    let event = AudioStreamEvent::Spectrum {
                        session_id: session_id.clone(),
                        frequencies: spectrum.frequencies,
                        magnitudes: spectrum.magnitudes_db,
                        timestamp_ms: chrono::Utc::now().timestamp_millis(),
                    };
                    let _ = sender.send(event).await;
                }
            }
        }

        Ok(processed)
    }

    pub async fn is_any_capturing(&self) -> bool {
        let sessions = self.sessions.read().await;
        sessions.values().any(|s| s.running.load(Ordering::SeqCst))
    }

    pub async fn active_sessions(&self) -> Vec<String> {
        let sessions = self.sessions.read().await;
        sessions
            .iter()
            .filter(|(_, s)| s.running.load(Ordering::SeqCst))
            .map(|(id, _)| id.clone())
            .collect()
    }

    pub fn backend_type(&self) -> AudioBackendType {
        AudioBackendType::Real
    }

    pub async fn list_devices(&self) -> crate::domain::DomainResult<Vec<crate::domain::trait_audio_capture::AudioDevice>> {
        let capture_guard = self.capture.read().await;
        match capture_guard.as_ref() {
            Some(c) => c.get_devices().await,
            None => {
                // Static enumeration avoids opening a capture stream before a
                // start request.
                Ok(RealAudioCapture::list_devices())
            }
        }
    }

    pub async fn shutdown(&self) {
        info!("Shutting down AudioStreamManager");
        self.stop_signal.store(true, Ordering::SeqCst);

        if let Some(capture) = self.capture.write().await.as_mut()
            && capture.is_capturing() {
                let _ = capture.stop().await;
            }

        self.sessions.write().await.clear();

        if let Some(sender) = self.event_sender.read().await.as_ref() {
            let _ = sender.send(AudioStreamEvent::Error {
                session_id: "system".to_string(),
                message: "Stream manager shutting down".to_string(),
            }).await;
        }

        info!("AudioStreamManager shutdown complete");
    }
}

impl Default for AudioStreamManager {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Debug for AudioStreamManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AudioStreamManager")
            .field("backend", &self.backend_type())
            .finish_non_exhaustive()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_manager_creation() {
        let manager = AudioStreamManager::new();
        assert!(!manager.is_any_capturing().await);
        assert!(manager.active_sessions().await.is_empty());
    }

    #[tokio::test]
    async fn test_session_registration() {
        let manager = AudioStreamManager::new();

        let config = StreamConfig {
            session_id: "test-session".to_string(),
            ..Default::default()
        };

        manager.register_session(config.clone()).await.unwrap();
        assert!(manager.get_session_config("test-session").await.is_some());

        assert!(manager.register_session(config).await.is_err());
    }

    #[tokio::test]
    async fn test_session_unregistration() {
        let manager = AudioStreamManager::new();

        let config = StreamConfig {
            session_id: "test-session".to_string(),
            ..Default::default()
        };

        manager.register_session(config).await.unwrap();
        assert!(manager.unregister_session("test-session").await);
        assert!(!manager.unregister_session("nonexistent").await);
    }

    #[tokio::test]
    async fn test_capture_lifecycle() {
        let manager = AudioStreamManager::new();
        manager.init_capture().await.unwrap();

        let config = StreamConfig {
            session_id: "test-session".to_string(),
            ..Default::default()
        };
        manager.register_session(config).await.unwrap();

        assert!(!manager.is_any_capturing().await);
    }
}