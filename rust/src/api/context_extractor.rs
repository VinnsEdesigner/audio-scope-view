#![allow(dead_code)]

use crate::api::auth::ApiKey;
use crate::application::{
    DashboardService, RecordingService, SessionService, SettingsService, WaveformService,
};
use crate::domain::UserPreferencesRepository;
use crate::infrastructure::AudioStreamManager;
use std::sync::Arc;

#[derive(Clone, Default)]
pub struct ApiKeyAuth {
    pub api_key: Option<ApiKey>,
    pub is_bootstrap: bool,
}

#[derive(Clone)]
pub struct GraphqlContext {
    pub session_service: Arc<SessionService>,
    pub settings_service: Arc<SettingsService>,
    pub dashboard_service: Arc<DashboardService>,
    pub waveform_service: Arc<WaveformService>,
    pub recording_service: Arc<RecordingService>,
    pub user_preferences_repository: Arc<dyn UserPreferencesRepository>,
    pub audio_manager: Arc<AudioStreamManager>,
    pub auth: ApiKeyAuth,
}

impl GraphqlContext {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        session_service: Arc<SessionService>,
        settings_service: Arc<SettingsService>,
        dashboard_service: Arc<DashboardService>,
        waveform_service: Arc<WaveformService>,
        recording_service: Arc<RecordingService>,
        user_preferences_repository: Arc<dyn UserPreferencesRepository>,
        audio_manager: Arc<AudioStreamManager>,
    ) -> Self {
        Self {
            session_service,
            settings_service,
            dashboard_service,
            waveform_service,
            recording_service,
            user_preferences_repository,
            audio_manager,
            auth: ApiKeyAuth::default(),
        }
    }

    pub fn with_auth(self, api_key: Option<ApiKey>, is_bootstrap: bool) -> Self {
        Self {
            auth: ApiKeyAuth {
                api_key,
                is_bootstrap,
            },
            ..self
        }
    }

    pub fn is_authenticated(&self) -> bool {
        self.auth.api_key.is_some() || self.auth.is_bootstrap
    }
}

/// Extracts the data-scoping device id from the GraphQL request context.
///
/// Returns:
/// - `Some(device_id)` — scope all queries to this device (normal client).
/// - `None` — unscoped admin/system view (bootstrap key with no device id).
///
/// When a `RequestIdentity` was not attached to the request (e.g. the schema is
/// exercised outside the HTTP handler in tests), we fall back to `None` so the
/// query still executes, rather than erroring.
pub fn device_scope_from_context(ctx: &async_graphql::Context<'_>) -> Option<String> {
    ctx.data_opt::<crate::api::server_graphql::RequestIdentity>()
        .and_then(|id| id.effective_device_id().map(|s| s.to_string()))
}
