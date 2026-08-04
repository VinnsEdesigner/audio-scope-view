
use super::types::Waveform;
use crate::domain::_shared::domain_errors::{DomainError, DomainResult};
use crate::domain::_shared::domain_validation::validate_samples;

pub fn validate_waveform(waveform: &Waveform) -> DomainResult<()> {
    validate_samples(&waveform.samples)?;

    if waveform.session_id.is_empty() {
        return Err(DomainError::validation("Waveform must have a session_id"));
    }

    Ok(())
}