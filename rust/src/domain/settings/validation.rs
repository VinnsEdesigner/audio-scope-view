//! Settings validation

use super::types::UpdateSettingsParams;
use crate::domain::_shared::domain_errors::{DomainError, DomainResult};
use crate::domain::_shared::domain_validation::{
    validate_time_scale, validate_trigger_level, validate_voltage_scale,
};

/// Validate settings update parameters
pub fn validate_update_params(params: &UpdateSettingsParams) -> DomainResult<()> {
    if let Some(scale) = params.time_scale {
        validate_time_scale(scale)?;
    }
    
    if let Some(scale) = params.voltage_scale {
        validate_voltage_scale(scale)?;
    }
    
    if let Some(level) = params.trigger_level {
        let range = params.voltage_scale.unwrap_or(1.0) * 4.0; // Assume ±4 divisions
        validate_trigger_level(level, range)?;
    }
    
    Ok(())
}
