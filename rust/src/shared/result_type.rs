//! Result type aliases

#![allow(dead_code)]
use crate::shared::error_app::AppError;

/// Application result type
pub type Result<T> = std::result::Result<T, AppError>;
