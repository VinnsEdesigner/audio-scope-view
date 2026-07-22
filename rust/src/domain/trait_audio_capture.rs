//! Audio capture trait - Interface for audio capture implementations

#![allow(dead_code)]

use crate::domain::DomainResult;
use async_trait::async_trait;

/// Audio capture trait
/// Defines the interface for audio capture implementations
#[async_trait]
#[allow(async_fn_in_trait)]
pub trait AudioCapture: Send + Sync {
    /// Start capturing audio
    async fn start(&mut self, device_id: Option<&str>) -> DomainResult<()>;

    /// Stop capturing audio
    async fn stop(&mut self) -> DomainResult<()>;

    /// Pause capturing
    async fn pause(&mut self) -> DomainResult<()>;

    /// Resume capturing
    async fn resume(&mut self) -> DomainResult<()>;

    /// Check if currently capturing
    fn is_capturing(&self) -> bool;

    /// Read audio samples into buffer
    /// Returns the number of samples read
    async fn read_samples(&mut self, buffer: &mut [f32]) -> DomainResult<u32>;

    /// Get available audio input devices
    async fn get_devices(&self) -> DomainResult<Vec<crate::domain::AudioDevice>>;
}

/// Audio input device information
#[derive(Debug, Clone, PartialEq)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub channels: u32,
    pub sample_rate: u32,
    pub is_default: bool,
}

impl AudioDevice {
    /// Create a new audio device
    pub fn new(id: String, name: String) -> Self {
        Self {
            id,
            name,
            channels: 2,
            sample_rate: 44100,
            is_default: false,
        }
    }

    /// Set channels
    pub fn with_channels(mut self, channels: u32) -> Self {
        self.channels = channels;
        self
    }

    /// Set sample rate
    pub fn with_sample_rate(mut self, rate: u32) -> Self {
        self.sample_rate = rate;
        self
    }

    /// Mark as default device
    pub fn with_default(mut self) -> Self {
        self.is_default = true;
        self
    }
}
