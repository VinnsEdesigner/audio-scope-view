//! Mock audio capture for testing - generates sine waves for demo purposes
#![allow(dead_code)]

use crate::domain::DomainResult;
use crate::domain::trait_audio_capture::{AudioCapture, AudioDevice};
use async_trait::async_trait;
use std::f64::consts::PI;

/// Mock audio capture implementation for testing
/// Generates various sine wave patterns for demo/testing
pub struct MockAudioCapture {
    is_capturing: bool,
    sample_rate: u32,
    phase: f64,
    frequency: f64, // Hz
    amplitude: f32,
    noise_level: f32,
}

impl MockAudioCapture {
    pub fn new() -> Self {
        Self {
            is_capturing: false,
            sample_rate: 44100,
            phase: 0.0,
            frequency: 440.0, // A4 note
            amplitude: 0.5,
            noise_level: 0.02,
        }
    }

    /// Set the frequency of the generated sine wave
    pub fn with_frequency(mut self, freq: f64) -> Self {
        self.frequency = freq;
        self
    }

    /// Set the amplitude (0.0 to 1.0)
    pub fn with_amplitude(mut self, amp: f32) -> Self {
        self.amplitude = amp.clamp(0.0, 1.0);
        self
    }

    /// Set the sample rate
    pub fn with_sample_rate(mut self, rate: u32) -> Self {
        self.sample_rate = rate;
        self
    }

    /// Set noise level (0.0 to 1.0)
    pub fn with_noise(mut self, level: f32) -> Self {
        self.noise_level = level.clamp(0.0, 1.0);
        self
    }

    /// Get the current sample rate
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    /// Generate a single sample
    fn generate_sample(&mut self) -> f32 {
        let angle = self.phase * 2.0 * PI;
        let sample = (angle.sin() as f32) * self.amplitude;
        self.phase += self.frequency / self.sample_rate as f64;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }
        sample
    }

    /// Generate white noise
    fn generate_noise(&self) -> f32 {
        // Simple pseudo-random noise based on phase
        let noise = ((self.phase * 12345.6789_f64).sin() * 1000.0) as i32;
        (noise % 100) as f32 / 100.0 * self.noise_level
    }
}

impl Default for MockAudioCapture {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl AudioCapture for MockAudioCapture {
    async fn start(&mut self, _device_id: Option<&str>) -> DomainResult<()> {
        self.is_capturing = true;
        self.phase = 0.0; // Reset phase when starting
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
            // Fill with silence if not capturing
            for sample in buffer.iter_mut() {
                *sample = 0.0;
            }
            return Ok(buffer.len() as u32);
        }

        for sample in buffer.iter_mut() {
            *sample = self.generate_sample() + self.generate_noise();
        }
        Ok(buffer.len() as u32)
    }

    async fn get_devices(&self) -> DomainResult<Vec<AudioDevice>> {
        Ok(vec![
            AudioDevice::new("mock".to_string(), "Mock Audio Device".to_string())
                .with_default()
                .with_sample_rate(self.sample_rate)
                .with_channels(1),
        ])
    }
}
