#![allow(dead_code)]
//! Dashboard resolver - Business logic for dashboard operations

use crate::domain::DashboardSummary;

/// Dashboard resolver trait
pub trait DashboardResolver: Send + Sync {
    fn resolve_total_scopes(&self, summary: &DashboardSummary) -> u32 {
        summary.total_scopes
    }
    fn resolve_active_scopes(&self, summary: &DashboardSummary) -> u32 {
        summary.active_scopes
    }
}
