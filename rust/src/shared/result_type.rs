#![allow(dead_code)]
use crate::shared::error_app::AppError;

pub type Result<T> = std::result::Result<T, AppError>;
