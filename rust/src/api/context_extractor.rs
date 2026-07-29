#![allow(dead_code)]
//! GraphQL context - Injected into all resolvers

use crate::application::{DashboardService, RecordingService, SessionService, SettingsService, WaveformService};
use crate::api::auth::ApiKey;
use std::sync::Arc;

/// Optional API key info extracted from request
#[derive(Clone, Default)]
pub struct ApiKeyAuth {
    pub api_key: Option<ApiKey>,
    pub is_bootstrap: bool,
}

/// GraphQL context containing application services
#[derive(Clone)]
pub struct GraphqlContext {
    pub session_service: Arc<SessionService>,
    pub settings_service: Arc<SettingsService>,
    pub dashboard_service: Arc<DashboardService>,
    pub waveform_service: Arc<WaveformService>,
    pub recording_service: Arc<RecordingService>,
    pub auth: ApiKeyAuth,
}

impl GraphqlContext {
    pub fn new(
        session_service: Arc<SessionService>,
        settings_service: Arc<SettingsService>,
        dashboard_service: Arc<DashboardService>,
        waveform_service: Arc<WaveformService>,
        recording_service: Arc<RecordingService>,
    ) -> Self {
        Self {
            session_service,
            settings_service,
            dashboard_service,
            waveform_service,
            recording_service,
            auth: ApiKeyAuth::default(),
        }
    }

    pub fn with_auth(self, api_key: Option<ApiKey>, is_bootstrap: bool) -> Self {
        Self {
            auth: ApiKeyAuth { api_key, is_bootstrap },
            ..self
        }
    }

    pub fn is_authenticated(&self) -> bool {
        self.auth.api_key.is_some() || self.auth.is_bootstrap
    }
}
