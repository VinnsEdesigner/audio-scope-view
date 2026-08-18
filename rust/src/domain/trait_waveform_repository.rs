#![allow(dead_code)]
use crate::domain::{DomainResult, Waveform};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Default)]
pub struct WaveformStatistics {
    pub total_count: u64,
    pub total_samples: u64,
    pub average_peak: f32,
    pub average_rms: f32,
}

#[async_trait::async_trait]
pub trait WaveformRepository: Send + Sync {
    async fn save(&self, waveform: &Waveform) -> DomainResult<()>;

    async fn find_by_id(&self, id: &str) -> DomainResult<Option<Waveform>>;

    async fn find_by_session(
        &self,
        session_id: &str,
        limit: u32,
        offset: u32,
    ) -> DomainResult<Vec<Waveform>>;

    async fn find_recent(&self, session_id: &str, limit: u32) -> DomainResult<Vec<Waveform>>;

    async fn count_by_session(&self, session_id: &str) -> DomainResult<u64>;

    async fn delete_by_session(&self, session_id: &str) -> DomainResult<u64>;

    async fn delete_older_than(&self, before: DateTime<Utc>) -> DomainResult<u64>;

    async fn get_statistics(&self, session_id: &str) -> DomainResult<WaveformStatistics>;
}
