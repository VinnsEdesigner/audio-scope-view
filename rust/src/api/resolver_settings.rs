#![allow(dead_code)]
//! Settings resolver - Business logic for settings operations

use crate::domain::Settings;

/// Settings resolver trait
pub trait SettingsResolver: Send + Sync {
    fn resolve_id<'a>(&self, settings: &'a Settings) -> &'a str {
        &settings.id
    }
    fn resolve_session_id<'a>(&self, settings: &'a Settings) -> &'a str {
        &settings.session_id
    }
    fn resolve_time_scale(&self, settings: &Settings) -> f64 {
        settings.time_scale
    }
}
