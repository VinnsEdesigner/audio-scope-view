
#![allow(dead_code)]

use std::sync::Arc;

use async_graphql::http::GraphiQLSource;
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{
    body::Body,
    response::Html,
    Router,
    extract::State,
    response::IntoResponse,
    routing::{get, post},
    middleware::from_fn,
};
use http::header::{AUTHORIZATION};
use sha2::{Sha256, Digest};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;

use crate::api::auth::{ApiKey, ApiKeyStore};
use crate::api::context_extractor::GraphqlContext;
use crate::api::handler_recording::{get_recording_samples, get_recording_metadata, stream_recording_pcm, stream_recording_csv, stream_recording_wav, stream_recording_json};
use crate::api::schema_root::build_schema;
use crate::api::websocket::{WsState, ws_handler};
use crate::application::{BatchCaptureService, DashboardService, RecordingService, SessionService, SettingsService, SimulationService, WaveformService};
use crate::shared::constants::{GRAPHQL_PATH, GRAPHQL_PLAYGROUND_PATH, HEALTH_PATH};

/// HTTP header carrying the per-device anonymous identity.
pub const DEVICE_ID_HEADER: &str = "x-device-id";

/// Resolved request identity used for data scoping.
///
/// `device_id` is the per-device anonymous identifier (from the `X-Device-Id`
/// header). When present, all data queries are scoped to it so one device never
/// sees another device's sessions/recordings/preferences. When absent (e.g. an
/// admin using the bootstrap key via the playground), queries are unscoped.
///
/// This is NOT user-facing authentication — there is no signup/login. The
/// bootstrap key remains the transport-level credential; the device id is the
/// data-isolation dimension. Real user auth is provided by the parent platform.
#[derive(Clone, Debug)]
pub struct RequestIdentity {
    pub device_id: Option<String>,
    pub is_system_client: bool,
    pub api_key: Option<ApiKey>,
}

impl RequestIdentity {
    /// Returns the effective device id, falling back to the api-key id when a
    /// named api key was used (so api-key-authenticated clients are also scoped).
    pub fn effective_device_id(&self) -> Option<&str> {
        if let Some(ref d) = self.device_id {
            return Some(d.as_str());
        }
        if let Some(ref k) = self.api_key {
            return Some(k.id.as_str());
        }
        None
    }

    /// True when this request is the shared system/bootstrap credential and has
    /// no device id — i.e. an admin/tooling context that may see all data.
    pub fn is_unscoped_admin(&self) -> bool {
        self.is_system_client && self.device_id.is_none() && self.api_key.is_none()
    }
}

pub struct ApiKeyAuth {
    pub key_info: Option<ApiKey>,
    pub is_system_client: bool,  }

pub struct AppState {
    pub graphql_schema: async_graphql::Schema<
        crate::api::schema_root::Query,
        crate::api::schema_root::Mutation,
        crate::api::schema_root::Subscription,
    >,
    pub context: GraphqlContext,
    pub ws_state: Arc<WsState>,
    pub simulation_service: Arc<SimulationService>,
    pub batch_capture_service: Arc<BatchCaptureService>,
    pub recording_service: Arc<RecordingService>,
    pub bootstrap_key_hash: [u8; 32],      pub key_store: Arc<ApiKeyStore>,    }

async fn extract_auth_header(
    req: http::Request<Body>,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let auth_header = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let device_id = req
        .headers()
        .get(DEVICE_ID_HEADER)
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.trim().to_string());

    let mut req = req;
    // NOTE: auth_header and device_id must be stored under distinct types —
    // axum's Extension map is keyed by type, so two `Option<String>` values
    // would collide and the second insert would silently overwrite the first
    // (which previously caused the Authorization value to be replaced by the
    // X-Device-Id value). We wrap each in a dedicated newtype to avoid that.
    req.extensions_mut().insert(AuthHeaderExt(auth_header));
    req.extensions_mut().insert(DeviceIdExt(device_id));

    next.run(req).await
}

/// Wrapper for the extracted Authorization header value.
#[derive(Clone, Debug)]
pub struct AuthHeaderExt(pub Option<String>);

/// Wrapper for the extracted X-Device-Id header value.
#[derive(Clone, Debug)]
pub struct DeviceIdExt(pub Option<String>);

fn derive_verification_key(bootstrap_key: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(bootstrap_key.as_bytes());
    hasher.update(b"audio-scope-view-system-verification");     hasher.finalize().into()
}

fn verify_bootstrap_key(provided_key: &str, expected_hash: &[u8; 32]) -> bool {
    let mut hasher = Sha256::new();
    hasher.update(provided_key.as_bytes());
    hasher.update(b"audio-scope-view-system-verification");
    let provided_hash: [u8; 32] = hasher.finalize().into();
    provided_hash == *expected_hash
}

impl AppState {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        session_service: Arc<SessionService>,
        settings_service: Arc<SettingsService>,
        dashboard_service: Arc<DashboardService>,
        waveform_service: Arc<WaveformService>,
        recording_service: Arc<RecordingService>,
        simulation_service: Arc<SimulationService>,
        batch_capture_service: Arc<BatchCaptureService>,
        bootstrap_key: String,
        key_store: Arc<ApiKeyStore>,
        user_preferences_repository: Arc<dyn crate::domain::UserPreferencesRepository>,
    ) -> Self {
        let context = GraphqlContext::new(
            session_service.clone(),
            settings_service,
            dashboard_service,
            waveform_service,
            recording_service.clone(),
            user_preferences_repository,
        );

        let schema = build_schema();
        let ws_state = Arc::new(WsState::new());

        let bootstrap_key_hash = derive_verification_key(&bootstrap_key);

        Self {
            graphql_schema: schema,
            context,
            ws_state,
            simulation_service,
            batch_capture_service,
            recording_service,
            bootstrap_key_hash,
            key_store,
        }
    }

    pub fn ws_state(&self) -> Arc<WsState> {
        self.ws_state.clone()
    }

    pub async fn validate_api_key(&self, auth_header: Option<&str>) -> (Option<ApiKey>, bool) {
        let header = match auth_header {
            Some(h) => h,
            None => return (None, false),
        };

        let key = if let Some(stripped) = header.strip_prefix("Bearer ") {
            stripped
        } else {
            header
        };

        if let Some(api_key) = self.key_store.validate(key).await {
            return (Some(api_key), false);
        }

        if verify_bootstrap_key(key, &self.bootstrap_key_hash) {
            return (None, true);
        }

        (None, false)
    }

    /// Resolve the request identity (auth + device id) for REST handlers. The
    /// `auth_header` and `device_id` are injected by the `extract_auth_header`
    /// middleware. Returns `None` when the request is not authenticated.
    pub async fn resolve_identity(
        &self,
        auth_header: Option<&str>,
        device_id: Option<&str>,
    ) -> Option<crate::api::server_graphql::RequestIdentity> {
        let (api_key, is_system_client) = self.validate_api_key(auth_header).await;
        if api_key.is_none() && !is_system_client {
            return None;
        }
        Some(crate::api::server_graphql::RequestIdentity {
            device_id: device_id.filter(|s| !s.trim().is_empty()).map(|s| s.trim().to_string()),
            is_system_client,
            api_key,
        })
    }

    /// Returns `Ok(())` when the caller may access `recording_id`. Access is
    /// granted when the recording's session belongs to the requesting device, or
    /// when the caller is an unscoped admin (bootstrap key, no device id).
    pub async fn check_recording_access(
        &self,
        identity: &crate::api::server_graphql::RequestIdentity,
        recording_id: &str,
    ) -> Result<(), AccessDenied> {
        if identity.is_unscoped_admin() {
            return Ok(());
        }
        let device_id = match identity.effective_device_id() {
            Some(d) => d.to_string(),
            None => return Err(AccessDenied),
        };

        let recording = self
            .recording_service
            .get(recording_id)
            .await
            .map_err(|_| AccessDenied)?
            .ok_or(AccessDenied)?;

        let session = self
            .context
            .session_service
            .get(&recording.session_id)
            .await
            .map_err(|_| AccessDenied)?
            .ok_or(AccessDenied)?;

        if session.user_id == device_id {
            Ok(())
        } else {
            Err(AccessDenied)
        }
    }
}

/// Error type indicating a recording access check failed (device mismatch or
/// not found). Handlers map this to a 404 to avoid leaking existence.
#[derive(Debug)]
pub struct AccessDenied;

async fn graphql_handler(
    State(state): State<Arc<AppState>>,
    axum::extract::Extension(AuthHeaderExt(auth_header)): axum::extract::Extension<AuthHeaderExt>,
    axum::extract::Extension(DeviceIdExt(device_id)): axum::extract::Extension<DeviceIdExt>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    let mut request = req.into_inner();

    info!("REQUEST: POST /graphql");

    let (api_key_info, is_system_client) = state.validate_api_key(auth_header.as_deref()).await;

    if api_key_info.is_none() && !is_system_client {
        info!("AUTH: FAILED - invalid or missing API key");
        let resp = async_graphql::Response::from_errors(
            vec![async_graphql::ServerError::new(
                "Unauthorized: Invalid or missing API key. Provide a valid key via Authorization: Bearer <key> header",
                None,
            )]
        );
        return resp.into();
    }

    let auth_type = if is_system_client {
        "bootstrap_key"
    } else {
        api_key_info.as_ref().map(|k| k.name.as_str()).unwrap_or("unknown")
    };
    let scope = device_id.as_deref().unwrap_or("<unscoped>");
    info!("AUTH: OK - {} (device: {})", auth_type, scope);

    let identity = RequestIdentity {
        device_id: device_id.clone(),
        is_system_client,
        api_key: api_key_info.clone(),
    };

    request = request.data(state.clone());
    request = request.data(state.context.clone());
    request = request.data(state.ws_state.clone());
    request = request.data(state.key_store.clone());
    request = request.data(identity);
    request = request.data(ApiKeyAuth {
        key_info: api_key_info,
        is_system_client,
    });

    let response: GraphQLResponse = state.graphql_schema.execute(request).await.into();
    info!("RESPONSE: 200 OK");
    response
}

async fn health_handler() -> impl IntoResponse {
    info!("REQUEST: GET /health");
    info!("RESPONSE: 200 OK");
    (http::StatusCode::OK, "Yes am alive")
}

async fn playground_handler() -> impl IntoResponse {
    Html(
        GraphiQLSource::build()
            .endpoint("/graphql")
            .subscription_endpoint("/graphql/ws")
            .finish(),
    )
}

pub fn build_router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let auth_middleware = from_fn(extract_auth_header);

    let graphql_router = Router::new()
        .route(GRAPHQL_PATH, post(graphql_handler))
        .route(GRAPHQL_PLAYGROUND_PATH, get(playground_handler))
        .layer(auth_middleware)
        .with_state(state.clone());

    // Custom WebSocket handler for real-time audio data. Shares the full
    // `AppState` so the handler can authenticate the connection (bootstrap key
    // or API key from the query string) and verify that each session a client
    // subscribes to belongs to the connecting device.
    let ws_router = Router::new()
        .route("/", get(ws_handler))
        .layer(CorsLayer::permissive())
        .layer(from_fn(extract_auth_header))
        .with_state(state.clone());

    // REST recording endpoints share the same auth + device-id extraction so the
    // server can verify a recording belongs to the requesting device before
    // returning samples/metadata/streams.
    let recordings_router = Router::new()
        .route("/api/recordings/{id}/samples", get(get_recording_samples))
        .route("/api/recordings/{id}/stream", get(stream_recording_pcm))
        .route("/api/recordings/{id}/metadata", get(get_recording_metadata))
        .route("/api/recordings/{id}/csv", get(stream_recording_csv))
        .route("/api/recordings/{id}/wav", get(stream_recording_wav))
        .route("/api/recordings/{id}/json", get(stream_recording_json))
        .layer(from_fn(extract_auth_header))
        .with_state(state.clone());

    Router::new()
        .route(HEALTH_PATH, get(health_handler))
        .nest("/graphql", graphql_router)
        .nest("/ws", ws_router)
        .merge(recordings_router)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}

pub async fn start_server(
    address: &str,
    state: Arc<AppState>,
) -> Result<(), Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind(address).await?;

    info!("Server listening on http://{address}");
    axum::serve(listener, build_router(state)).await?;

    Ok(())
}