#![allow(dead_code)]
//! Dashboard resolver - Business logic for dashboard operations

use crate::domain::DashboardSummary;

/// Dashboard resolver trait
pub trait DashboardResolver: Send + Sync {
    fn resolve_total_sessions(&self, summary: &DashboardSummary) -> u32 {
        summary.total_sessions
    }
    fn resolve_active_sessions(&self, summary: &DashboardSummary) -> u32 {
        summary.active_sessions
    }
}
