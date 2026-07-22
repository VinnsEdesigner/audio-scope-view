//! Domain shared utilities
//! 
//! Re-exports shared domain types and utilities used across features.

pub mod domain_errors;
pub mod domain_pagination;
pub mod domain_validation;

pub use domain_errors::{DomainError, DomainResult};
pub use domain_pagination::{OffsetPagination, CursorPagination, PaginationParams};
pub use domain_validation::{validate_id, validate_name, ValidationError};
