#![allow(dead_code)]
//! Application error types

use thiserror::Error;

/// Application-level errors
#[derive(Error, Debug)]
pub enum AppError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Domain error: {0}")]
    Domain(#[from] crate::domain::DomainError),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("GraphQL error: {0}")]
    Graphql(String),
}

impl AppError {
    pub fn config(msg: &str) -> Self {
        Self::Config(msg.to_string())
    }

    pub fn database(msg: &str) -> Self {
        Self::Database(msg.to_string())
    }

    pub fn not_found(msg: &str) -> Self {
        Self::NotFound(msg.to_string())
    }

    pub fn validation(msg: &str) -> Self {
        Self::Validation(msg.to_string())
    }

    pub fn internal(msg: &str) -> Self {
        Self::Internal(msg.to_string())
    }

    pub fn graphql(msg: &str) -> Self {
        Self::Graphql(msg.to_string())
    }
}

/// Result type alias for application operations
pub type AppResult<T> = Result<T, AppError>;
