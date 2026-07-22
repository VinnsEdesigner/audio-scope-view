//! Scope validation

use super::types::{CreateScopeParams, UpdateScopeParams};
use crate::domain::_shared::domain_errors::{DomainError, DomainResult};
use crate::domain::_shared::domain_validation::{
    validate_buffer_size, validate_id, validate_name, validate_sample_rate,
};

/// Validate scope creation parameters
pub fn validate_create_params(params: &CreateScopeParams) -> DomainResult<()> {
    validate_name(&params.name)?;
    
    if let Some(rate) = params.sample_rate {
        validate_sample_rate(rate)?;
    }
    
    if let Some(size) = params.buffer_size {
        validate_buffer_size(size)?;
    }
    
    Ok(())
}

/// Validate scope update parameters
pub fn validate_update_params(params: &UpdateScopeParams) -> DomainResult<()> {
    if let Some(ref name) = params.name {
        validate_name(name)?;
    }
    
    if let Some(rate) = params.sample_rate {
        validate_sample_rate(rate)?;
    }
    
    if let Some(size) = params.buffer_size {
        validate_buffer_size(size)?;
    }
    
    Ok(())
}

/// Validate scope ID
pub fn validate_scope_id(id: &str) -> DomainResult<()> {
    validate_id(id)
}
