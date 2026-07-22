//! Waveform-specific domain errors

use crate::domain::_shared::domain_errors::DomainError;

/// Error types specific to waveform operations
#[derive(Debug, Clone)]
pub enum WaveformError {
    WaveformNotFound(String),
    EmptyWaveform,
    TooManySamples(usize),
    InvalidSampleRate(u32),
    StorageError(String),
}

impl From<WaveformError> for DomainError {
    fn from(err: WaveformError) -> Self {
        match err {
            WaveformError::WaveformNotFound(id) => DomainError::not_found("Waveform", &id),
            WaveformError::EmptyWaveform => {
                DomainError::validation("Waveform cannot be empty")
            }
            WaveformError::TooManySamples(count) => {
                DomainError::validation(format!("Waveform has too many samples: {}", count))
            }
            WaveformError::InvalidSampleRate(rate) => {
                DomainError::validation(format!("Invalid sample rate: {}", rate))
            }
            WaveformError::StorageError(msg) => {
                DomainError::repository(msg)
            }
        }
    }
}
