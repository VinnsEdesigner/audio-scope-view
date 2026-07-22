
#![allow(dead_code)]
use crate::domain::DomainResult;
use crate::domain::trait_audio_capture::{AudioCapture, AudioDevice};
use async_trait::async_trait;

/// PulseAudio capture - stub implementation
pub struct PulseAudioCapture {
    is_capturing: bool,
    sample_rate: u32,
}

impl PulseAudioCapture {
    pub fn new() -> Self {
        Self {
            is_capturing: false,
            sample_rate: 44100,
        }
    }

    /// Get the current sample rate
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }
}

impl Default for PulseAudioCapture {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl AudioCapture for PulseAudioCapture {
    async fn start(&mut self, _device_id: Option<&str>) -> DomainResult<()> {
        self.is_capturing = true;
        Ok(())
    }

    async fn stop(&mut self) -> DomainResult<()> {
        self.is_capturing = false;
        Ok(())
    }

    async fn pause(&mut self) -> DomainResult<()> {
        self.is_capturing = false;
        Ok(())
    }

    async fn resume(&mut self) -> DomainResult<()> {
        self.is_capturing = true;
        Ok(())
    }

    fn is_capturing(&self) -> bool {
        self.is_capturing
    }

    async fn read_samples(&mut self, buffer: &mut [f32]) -> DomainResult<u32> {
        if !self.is_capturing {
            for sample in buffer.iter_mut() {
                *sample = 0.0;
            }
            return Ok(buffer.len() as u32);
        }
        // Stub: return silence
        for sample in buffer.iter_mut() {
            *sample = 0.0;
        }
        Ok(buffer.len() as u32)
    }

    async fn get_devices(&self) -> DomainResult<Vec<AudioDevice>> {
        Ok(vec![
            AudioDevice::new(
                "default".to_string(),
                "Default PulseAudio Device".to_string(),
            )
            .with_default()
            .with_sample_rate(self.sample_rate),
        ])
    }
}
