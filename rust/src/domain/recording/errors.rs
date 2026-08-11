use thiserror::Error;

#[derive(Error, Debug)]
pub enum RecordingError {
    #[error("Recording not found: {0}")]
    NotFound(String),

    #[error("Invalid recording name: {0}")]
    InvalidName(String),

    #[error("Recording too large: {0} bytes (max: {1} bytes)")]
    TooLarge(u64, u64),

    #[error("Invalid duration: {0}ms")]
    InvalidDuration(f64),

    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("Scope not found: {0}")]
    ScopeNotFound(String),
}

impl From<RecordingError> for crate::domain::error_domain::DomainError {
    fn from(err: RecordingError) -> Self {
        crate::domain::error_domain::DomainError::InvalidOperation {
            message: err.to_string(),
        }
    }
}
