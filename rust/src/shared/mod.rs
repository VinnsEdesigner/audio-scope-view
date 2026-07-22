//! Shared utilities and types

#[allow(unused_imports)]
pub mod config_struct;
pub mod constants;
pub mod error_app;
pub mod result_type;

pub use config_struct::Config;
pub use constants::*;
pub use error_app::{AppError, AppResult};
