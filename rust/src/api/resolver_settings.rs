#![allow(dead_code)]

use crate::domain::Settings;

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