//! Recording domain module

pub mod errors;
pub mod types;
pub mod validation;

pub use errors::RecordingError;
pub use types::*;
pub use validation::RecordingValidator;
