
#![allow(dead_code)]

use crate::domain::DomainResult;
use async_trait::async_trait;

#[async_trait]
#[allow(async_fn_in_trait)]
pub trait AudioCapture: Send + Sync {
    async fn start(&mut self, device_id: Option<&str>) -> DomainResult<()>;

    async fn stop(&mut self) -> DomainResult<()>;

    async fn pause(&mut self) -> DomainResult<()>;

    async fn resume(&mut self) -> DomainResult<()>;

    fn is_capturing(&self) -> bool;

    async fn read_samples(&mut self, buffer: &mut [f32]) -> DomainResult<u32>;

    async fn get_devices(&self) -> DomainResult<Vec<crate::domain::AudioDevice>>;
}

#[derive(Debug, Clone, PartialEq)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub channels: u32,
    pub sample_rate: u32,
    pub is_default: bool,
}

impl AudioDevice {
    pub fn new(id: String, name: String) -> Self {
        Self {
            id,
            name,
            channels: 2,
            sample_rate: 44100,
            is_default: false,
        }
    }

    pub fn with_channels(mut self, channels: u32) -> Self {
        self.channels = channels;
        self
    }

    pub fn with_sample_rate(mut self, rate: u32) -> Self {
        self.sample_rate = rate;
        self
    }

    pub fn with_default(mut self) -> Self {
        self.is_default = true;
        self
    }
}