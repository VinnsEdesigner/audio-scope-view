//! Waveform repository trait

#![allow(dead_code)]
use crate::domain::{DomainResult, Waveform};
use chrono::{DateTime, Utc};

/// Waveform statistics
#[derive(Debug, Clone, Default)]
pub struct WaveformStatistics {
    pub total_count: u64,
    pub total_samples: u64,
    pub average_peak: f32,
    pub average_rms: f32,
}

/// Repository trait for Waveform entities
#[allow(async_fn_in_trait)]
pub trait WaveformRepository: Send + Sync {
    /// Save a waveform
    async fn save(&self, waveform: &Waveform) -> DomainResult<()>;

    /// Find a waveform by ID
    async fn find_by_id(&self, id: &str) -> DomainResult<Option<Waveform>>;

    /// Find waveforms by scope ID
    async fn find_by_scope(
        &self,
        scope_id: &str,
        limit: u32,
        offset: u32,
    ) -> DomainResult<Vec<Waveform>>;

    /// Find recent waveforms by scope ID
    async fn find_recent(&self, scope_id: &str, limit: u32) -> DomainResult<Vec<Waveform>>;

    /// Count waveforms by scope ID
    async fn count_by_scope(&self, scope_id: &str) -> DomainResult<u64>;

    /// Delete waveforms by scope ID
    async fn delete_by_scope(&self, scope_id: &str) -> DomainResult<u64>;

    /// Delete waveforms older than a date
    async fn delete_older_than(&self, before: DateTime<Utc>) -> DomainResult<u64>;

    /// Get statistics for a scope
    async fn get_statistics(&self, scope_id: &str) -> DomainResult<WaveformStatistics>;
}
