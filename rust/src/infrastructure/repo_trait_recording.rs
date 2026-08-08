#![allow(dead_code)]

//! Repository trait for recording storage.
//! Implemented by both SQLite and Turso repositories.

use crate::domain::error_domain::DomainError;
use crate::domain::recording::{
    Recording, RecordingFilter, RecordingMetadata, RecordingStats, RecordingSummary, TimeRange,
};

pub type DomainErrorResult<T> = Result<T, DomainError>;

#[async_trait::async_trait]
pub trait RecordingRepository: Send + Sync {
    async fn save(&self, recording: &Recording) -> DomainErrorResult<()>;
    async fn find_by_id(&self, id: &str) -> DomainErrorResult<Option<Recording>>;
    async fn find_metadata_by_id(&self, id: &str) -> DomainErrorResult<Option<RecordingMetadata>>;
    async fn list(
        &self,
        filter: Option<&RecordingFilter>,
        limit: u32,
        offset: u32,
    ) -> DomainErrorResult<(Vec<RecordingSummary>, u64, bool)>;
    async fn get_recent(&self, limit: u32) -> DomainErrorResult<Vec<RecordingSummary>>;
    async fn update(&self, recording: &Recording) -> DomainErrorResult<()>;
    async fn delete(&self, id: &str) -> DomainErrorResult<()>;
    async fn delete_many(&self, ids: &[String]) -> DomainErrorResult<u64>;
    async fn count_by_scope(&self, session_id: &str) -> DomainErrorResult<u64>;
    async fn get_stats(
        &self,
        session_id: Option<&str>,
        time_range: Option<TimeRange>,
    ) -> DomainErrorResult<RecordingStats>;
    async fn get_recording_count_by_range(
        &self,
        session_id: Option<&str>,
    ) -> DomainErrorResult<RecordingStats>;
}
