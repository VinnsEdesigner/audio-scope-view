//! Dashboard-specific domain errors

use crate::domain::_shared::domain_errors::DomainError;

/// Error types specific to dashboard operations
#[derive(Debug, Clone)]
pub enum DashboardError {
    SummaryGenerationFailed(String),
    InvalidTimeRange(String),
    DataRetrievalFailed(String),
}

impl From<DashboardError> for DomainError {
    fn from(err: DashboardError) -> Self {
        match err {
            DashboardError::SummaryGenerationFailed(msg) => {
                DomainError::internal(format!("Failed to generate dashboard summary: {}", msg))
            }
            DashboardError::InvalidTimeRange(msg) => {
                DomainError::validation(format!("Invalid time range: {}", msg))
            }
            DashboardError::DataRetrievalFailed(msg) => {
                DomainError::repository(format!("Failed to retrieve dashboard data: {}", msg))
            }
        }
    }
}
