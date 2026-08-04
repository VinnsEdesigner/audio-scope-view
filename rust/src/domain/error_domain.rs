
#![allow(dead_code)]
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DomainError {
    #[error("Entity not found: {entity_type} with id `{id}`")]
    NotFound {
        entity_type: &'static str,
        id: String,
    },

    #[error("Validation error: {message}")]
    Validation { message: String },

    #[error("Invalid operation: {message}")]
    InvalidOperation { message: String },

    #[error("Data corruption: {message}")]
    Corruption { message: String },

    #[error("Audio capture error: {message}")]
    CaptureError { message: String },

    #[error("Repository error: {message}")]
    Repository { message: String },
}

impl DomainError {
    pub fn not_found(entity_type: &'static str, id: impl Into<String>) -> Self {
        Self::NotFound {
            entity_type,
            id: id.into(),
        }
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::Validation {
            message: message.into(),
        }
    }

    pub fn invalid_operation(message: impl Into<String>) -> Self {
        Self::InvalidOperation {
            message: message.into(),
        }
    }

    pub fn capture_error(message: impl Into<String>) -> Self {
        Self::CaptureError {
            message: message.into(),
        }
    }

    pub fn repository(message: impl Into<String>) -> Self {
        Self::Repository {
            message: message.into(),
        }
    }

    pub fn corruption(message: impl Into<String>) -> Self {
        Self::Corruption {
            message: message.into(),
        }
    }
}

pub type DomainResult<T> = Result<T, DomainError>;