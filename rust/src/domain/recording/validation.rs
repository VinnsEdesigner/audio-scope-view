
#![allow(dead_code)]

use super::errors::RecordingError;
use super::Recording;

const MAX_NAME_LENGTH: usize = 255;

const MAX_RECORDING_SIZE: u64 = 100 * 1024 * 1024;

const MAX_DURATION_MS: f64 = 3600.0 * 1000.0;

#[derive(Debug, Default)]
pub struct RecordingValidator;

impl RecordingValidator {
    pub fn validate_name(name: &str) -> Result<(), RecordingError> {
        let trimmed = name.trim();

        if trimmed.is_empty() {
            return Err(RecordingError::InvalidName("Name cannot be empty".to_string()));
        }

        if trimmed.len() > MAX_NAME_LENGTH {
            return Err(RecordingError::InvalidName(format!(
                "Name too long: {} characters (max: {})",
                trimmed.len(),
                MAX_NAME_LENGTH
            )));
        }

        Ok(())
    }

    pub fn validate_size(size_bytes: u64) -> Result<(), RecordingError> {
        if size_bytes > MAX_RECORDING_SIZE {
            return Err(RecordingError::TooLarge(size_bytes, MAX_RECORDING_SIZE));
        }
        Ok(())
    }

    pub fn validate_duration(duration_ms: f64) -> Result<(), RecordingError> {
        if duration_ms <= 0.0 {
            return Err(RecordingError::InvalidDuration(duration_ms));
        }
        if duration_ms > MAX_DURATION_MS {
            return Err(RecordingError::InvalidDuration(duration_ms));
        }
        Ok(())
    }

    pub fn validate(recording: &Recording) -> Result<(), RecordingError> {
        Self::validate_name(&recording.name)?;
        Self::validate_size(recording.size_bytes)?;
        Self::validate_duration(recording.duration_ms)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_name_empty() {
        let result = RecordingValidator::validate_name("");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_name_too_long() {
        let long_name = "a".repeat(MAX_NAME_LENGTH + 1);
        let result = RecordingValidator::validate_name(&long_name);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_name_valid() {
        let result = RecordingValidator::validate_name("Test Recording");
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_size_valid() {
        let result = RecordingValidator::validate_size(1024);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_size_too_large() {
        let result = RecordingValidator::validate_size(MAX_RECORDING_SIZE + 1);
        assert!(result.is_err());
    }
}