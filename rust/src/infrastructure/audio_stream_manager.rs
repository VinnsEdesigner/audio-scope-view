
#![allow(dead_code, clippy::await_holding_lock, clippy::readonly_write_lock)]

use crate::domain::fft_processor::{FftProcessor, WindowType};
use crate::domain::trait_audio_capture::AudioCapture;
use crate::shared::constants::{DEFAULT_BUFFER_SIZE, DEFAULT_SAMPLE_RATE};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::RwLock;
use std::thread::JoinHandle;
use std::time::Instant;
use tokio::sync::mpsc;
use tracing::{info, warn};

#[cfg(feature = "real-audio")]
use crate::infrastructure::audio_capture_real::RealAudioCapture;
use crate::infrastructure::audio_capture_mock::MockAudioCapture;
use crate::infrastructure::audio_capture_pulse::PulseAudioCapture;

/// Message types for audio stream events
#[derive(Debug, Clone)]
pub enum AudioStreamEvent {
    /// New waveform data available
    Waveform {
        session_id: String,
        samples: Vec<f32>,
        timestamp_ms: i64,
        sample_rate: u32,
    },
    /// New spectrum data available
    Spectrum {
        session_id: String,
        frequencies: Vec<f32>,
        magnitudes: Vec<f32>,
        timestamp_ms: i64,
    },
    /// Audio device disconnected
    DeviceDisconnected {
        session_id: String,
        reason: String,
    },
    /// Error occurred
    Error {
        session_id: String,
        message: String,
    },
    /// Capture started
    CaptureStarted {
        session_id: String,
        sample_rate: u32,
    },
    /// Capture stopped
    CaptureStopped {
        session_id: String,
    },
}

/// Stream configuration
#[derive(Debug, Clone)]
pub struct StreamConfig {
    /// Session ID this stream is for
    pub session_id: String,
    /// Sample rate (0 = use default)
    pub sample_rate: u32,
    /// Buffer size in samples
    pub buffer_size: usize,
    /// Whether to compute spectrum
    pub enable_spectrum: bool,
    /// FFT window type
    pub fft_window: WindowType,
    /// FFT size (must be power of 2)
    pub fft_size: usize,
    /// Stream update interval in ms (0 = every buffer)
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

/// Statistics for a stream
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
        self.bytes_captured += count as u64 * 4; // f32 = 4 bytes
        self.last_update = Some(Instant::now());
    }

    fn record_buffer(&mut self) {
        self.buffers_processed += 1;
    }

    fn record_error(&mut self) {
        self.errors += 1;
    }
}

/// Per-session audio stream state
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

/// AudioStreamManager - Central manager for all audio streams
pub struct AudioStreamManager {
    /// Backend audio capture implementation
    #[cfg(feature = "real-audio")]
    capture: RwLock<Option<Box<dyn AudioCaptureBackend>>>,
    #[cfg(not(feature = "real-audio"))]
    capture: RwLock<Option<Box<dyn AudioCaptureBackend>>>,
    /// Per-session stream configurations
    sessions: RwLock<HashMap<String, SessionStream>>,
    /// FFT processor for spectrum analysis
    fft: RwLock<FftProcessor>,
    /// Event sender for broadcasting to clients
    event_sender: RwLock<Option<mpsc::Sender<AudioStreamEvent>>>,
    /// Background task handle
    task_handle: RwLock<Option<JoinHandle<()>>>,
    /// Master stop signal
    stop_signal: AtomicBool,
    /// Current backend type
    backend_type: RwLock<AudioBackendType>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum AudioBackendType {
    #[default]
    Mock,
    Pulse,
    #[cfg(feature = "real-audio")]
    Real,
}

/// Trait for audio capture backends
#[async_trait]
pub trait AudioCaptureBackend: Send + Sync {
    /// Start capturing audio
    async fn start(&mut self, device_id: Option<&str>) -> crate::domain::DomainResult<()>;
    /// Stop capturing audio
    async fn stop(&mut self) -> crate::domain::DomainResult<()>;
    /// Check if currently capturing
    fn is_capturing(&self) -> bool;
    /// Read audio samples
    async fn read_samples(&mut self, buffer: &mut [f32]) -> crate::domain::DomainResult<u32>;
    /// Get available devices
    async fn get_devices(&self) -> crate::domain::DomainResult<Vec<crate::domain::trait_audio_capture::AudioDevice>>;
    /// Get current sample rate
    fn sample_rate(&self) -> u32;
}

#[async_trait]
impl AudioCaptureBackend for MockAudioCapture {
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
        44100
    }
}

#[async_trait]
impl AudioCaptureBackend for PulseAudioCapture {
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
        44100
    }
}

#[cfg(feature = "real-audio")]
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
    /// Create a new AudioStreamManager
    pub fn new() -> Self {
        Self {
            capture: RwLock::new(None),
            sessions: RwLock::new(HashMap::new()),
            fft: RwLock::new(FftProcessor::new()),
            event_sender: RwLock::new(None),
            task_handle: RwLock::new(None),
            stop_signal: AtomicBool::new(false),
            backend_type: RwLock::new(AudioBackendType::Mock),
        }
    }

    /// Create with a specific backend
    pub fn with_backend(backend: AudioBackendType) -> Self {
        let manager = Self::new();
        *manager.backend_type.write().unwrap() = backend;
        manager
    }

    /// Initialize the capture backend
    pub async fn init_capture(&self) -> crate::domain::DomainResult<()> {
        let backend = *self.backend_type.read().unwrap();
        
        let capture: Box<dyn AudioCaptureBackend> = match backend {
            AudioBackendType::Mock => {
                info!("Initializing mock audio capture backend");
                Box::new(MockAudioCapture::new())
            }
            AudioBackendType::Pulse => {
                info!("Initializing PulseAudio capture backend");
                Box::new(PulseAudioCapture::new())
            }
            #[cfg(feature = "real-audio")]
            AudioBackendType::Real => {
                info!("Initializing real audio capture (cpal) backend");
                Box::new(RealAudioCapture::new().map_err(|e| {
                    crate::domain::DomainError::capture_error(format!("RealAudio init failed: {:?}", e))
                })?)
            }
        };

        *self.capture.write().unwrap() = Some(capture);
        Ok(())
    }

    /// Set the event sender for broadcasting events
    pub fn set_event_sender(&self, sender: mpsc::Sender<AudioStreamEvent>) {
        *self.event_sender.write().unwrap() = Some(sender);
    }

    /// Register a session stream configuration
    pub fn register_session(&self, config: StreamConfig) -> crate::domain::DomainResult<()> {
        let mut sessions = self.sessions.write().unwrap();
        if sessions.contains_key(&config.session_id) {
            return Err(crate::domain::DomainError::invalid_operation(
                format!("Session '{}' already registered", config.session_id)
            ));
        }
        sessions.insert(config.session_id.clone(), SessionStream::new(config));
        Ok(())
    }

    /// Unregister a session
    pub fn unregister_session(&self, session_id: &str) -> bool {
        let mut sessions = self.sessions.write().unwrap();
        sessions.remove(session_id).is_some()
    }

    /// Get session configuration
    pub fn get_session_config(&self, session_id: &str) -> Option<StreamConfig> {
        let sessions = self.sessions.read().unwrap();
        sessions.get(session_id).map(|s| s.config.clone())
    }

    /// Get session statistics
    pub fn get_session_stats(&self, session_id: &str) -> Option<StreamStats> {
        let sessions = self.sessions.read().unwrap();
        sessions.get(session_id).map(|s| s.stats.clone())
    }

    /// Start capture for a specific session
    pub async fn start_capture(&self, session_id: &str) -> crate::domain::DomainResult<()> {
        // Get or create session config
        let needs_register = {
            let sessions = self.sessions.read().unwrap();
            !sessions.contains_key(session_id)
        };

        if needs_register {
            // Auto-register with default config
            let config = StreamConfig {
                session_id: session_id.to_string(),
                ..Default::default()
            };
            self.register_session(config)?;
        }

        // Start the capture backend
        let mut capture_guard = self.capture.write().unwrap();
        if let Some(capture) = capture_guard.as_mut()
            && !capture.is_capturing() {
                capture.start(None).await?;
            }
        drop(capture_guard);

        // Update session state
        let mut sessions = self.sessions.write().unwrap();
        if let Some(session) = sessions.get_mut(session_id) {
            session.running.store(true, Ordering::SeqCst);
            session.capture_start = Some(Instant::now());
        }
        drop(sessions);

        // Send event
        if let Some(sender) = self.event_sender.read().unwrap().as_ref() {
            let _ = sender.send(AudioStreamEvent::CaptureStarted {
                session_id: session_id.to_string(),
                sample_rate: DEFAULT_SAMPLE_RATE,
            }).await;
        }

        info!("Started capture for session: {}", session_id);
        Ok(())
    }

    /// Stop capture for a specific session
    pub async fn stop_capture(&self, session_id: &str) -> crate::domain::DomainResult<()> {
        let mut sessions = self.sessions.write().unwrap();
        if let Some(session) = sessions.get_mut(session_id) {
            session.running.store(false, Ordering::SeqCst);
        }
        drop(sessions);

        // Check if any sessions are still running
        let any_running = {
            let sessions = self.sessions.read().unwrap();
            sessions.values().any(|s| s.running.load(Ordering::SeqCst))
        };

        // If no sessions running, stop the backend
        if !any_running {
            let mut capture_guard = self.capture.write().unwrap();
            if let Some(capture) = capture_guard.as_mut()
                && capture.is_capturing() {
                    capture.stop().await?;
                }
        }

        // Send event
        if let Some(sender) = self.event_sender.read().unwrap().as_ref() {
            let _ = sender.send(AudioStreamEvent::CaptureStopped {
                session_id: session_id.to_string(),
            }).await;
        }

        info!("Stopped capture for session: {}", session_id);
        Ok(())
    }

    /// Read samples and process for all active sessions
    pub async fn read_and_process(&self) -> crate::domain::DomainResult<usize> {
        let mut buffer = vec![0.0f32; 4096];
        
        // Get sample rate from capture before processing
        let sample_rate = {
            let capture_guard = self.capture.read().unwrap();
            match capture_guard.as_ref() {
                Some(c) if c.is_capturing() => c.sample_rate(),
                _ => return Ok(0),
            }
        };

        // Read samples
        {
            let mut capture_guard = self.capture.write().unwrap();
            if let Some(capture) = capture_guard.as_mut() {
                if !capture.is_capturing() {
                    return Ok(0);
                }
                
                let samples_read = capture.read_samples(&mut buffer).await?;
                if samples_read == 0 {
                    return Ok(0);
                }
            }
        }

        // Process for each active session
        let sessions = self.sessions.read().unwrap();
        let mut processed = 0;

        for (session_id, session) in sessions.iter() {
            if !session.running.load(Ordering::SeqCst) {
                continue;
            }

            // Update stats
            let mut session_stats = session.stats.clone();
            session_stats.record_samples(buffer.len());
            session_stats.record_buffer();
            
            // Calculate capture duration
            if let Some(start) = session.capture_start {
                session_stats.capture_duration_ms = start.elapsed().as_millis() as u64;
            }

            // Send waveform event
            if let Some(sender) = self.event_sender.read().unwrap().as_ref() {
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

            // Compute and send spectrum if enabled
            if session.config.enable_spectrum && buffer.len() >= session.config.fft_size {
                let mut fft = self.fft.write().unwrap();
                let spectrum = fft.compute_spectrum(
                    &buffer[..session.config.fft_size],
                    sample_rate as f32,
                    session.config.fft_window,
                );

                if let Some(sender) = self.event_sender.read().unwrap().as_ref() {
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

    /// Check if any session is actively capturing
    pub fn is_any_capturing(&self) -> bool {
        let sessions = self.sessions.read().unwrap();
        sessions.values().any(|s| s.running.load(Ordering::SeqCst))
    }

    /// Get list of active session IDs
    pub fn active_sessions(&self) -> Vec<String> {
        let sessions = self.sessions.read().unwrap();
        sessions
            .iter()
            .filter(|(_, s)| s.running.load(Ordering::SeqCst))
            .map(|(id, _)| id.clone())
            .collect()
    }

    /// Get current backend type
    pub fn backend_type(&self) -> AudioBackendType {
        *self.backend_type.read().unwrap()
    }

    /// List available audio devices
    pub async fn list_devices(&self) -> crate::domain::DomainResult<Vec<crate::domain::trait_audio_capture::AudioDevice>> {
        let capture_guard = self.capture.read().unwrap();
        match capture_guard.as_ref() {
            Some(c) => c.get_devices().await,
            None => Ok(vec![]),
        }
    }

    /// Shutdown the stream manager
    pub async fn shutdown(&self) {
        info!("Shutting down AudioStreamManager");
        self.stop_signal.store(true, Ordering::SeqCst);

        // Stop all captures
        if let Some(capture) = self.capture.write().unwrap().as_mut()
            && capture.is_capturing() {
                let _ = capture.stop().await;
            }

        // Clear all sessions
        self.sessions.write().unwrap().clear();

        // Send shutdown event
        if let Some(sender) = self.event_sender.read().unwrap().as_ref() {
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
        let backend = *self.backend_type.read().unwrap();
        let active = self.active_sessions();
        f.debug_struct("AudioStreamManager")
            .field("backend", &backend)
            .field("active_sessions", &active)
            .field("is_capturing", &self.is_any_capturing())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_manager_creation() {
        let manager = AudioStreamManager::new();
        assert!(!manager.is_any_capturing());
        assert!(manager.active_sessions().is_empty());
    }

    #[tokio::test]
    async fn test_session_registration() {
        let manager = AudioStreamManager::new();
        
        let config = StreamConfig {
            session_id: "test-session".to_string(),
            ..Default::default()
        };
        
        manager.register_session(config.clone()).unwrap();
        assert!(manager.get_session_config("test-session").is_some());
        
        // Duplicate registration should fail
        assert!(manager.register_session(config).is_err());
    }

    #[tokio::test]
    async fn test_session_unregistration() {
        let manager = AudioStreamManager::new();
        
        let config = StreamConfig {
            session_id: "test-session".to_string(),
            ..Default::default()
        };
        
        manager.register_session(config).unwrap();
        assert!(manager.unregister_session("test-session"));
        assert!(!manager.unregister_session("nonexistent"));
    }

    #[tokio::test]
    async fn test_capture_lifecycle() {
        let manager = AudioStreamManager::new();
        manager.init_capture().await.unwrap();
        
        // Register and start
        let config = StreamConfig {
            session_id: "test-session".to_string(),
            ..Default::default()
        };
        manager.register_session(config).unwrap();
        
        // Initially not capturing
        assert!(!manager.is_any_capturing());
    }
}
