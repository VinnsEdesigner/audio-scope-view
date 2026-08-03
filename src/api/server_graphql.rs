
#![allow(dead_code)]

use std::sync::Arc;

use async_graphql::http::GraphiQLSource;
use async_graphql_axum::{GraphQLRequest, GraphQLResponse, GraphQLSubscription};
use axum::{
    body::Body,
    response::Html,
    Router,
    extract::State,
    response::IntoResponse,
    routing::{get, post},
    middleware::from_fn,
};
use http::header::AUTHORIZATION;
use sha2::{Sha256, Digest};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;

use crate::api::auth::{ApiKey, ApiKeyStore};
use crate::api::context_extractor::GraphqlContext;
use crate::api::handler_recording::{get_recording_samples, get_recording_metadata, stream_recording_pcm};
use crate::api::schema_root::build_schema;
use crate::api::websocket::handler::WsState;
use crate::application::{BatchCaptureService, DashboardService, RecordingService, SessionService, SettingsService, SimulationService, WaveformService};
use crate::shared::constants::{GRAPHQL_PATH, GRAPHQL_PLAYGROUND_PATH, HEALTH_PATH};

pub struct ApiKeyAuth {
    pub key_info: Option<ApiKey>,
    pub is_system_client: bool,  // True if verified via bootstrap key (AES256 hash match)
}

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
    pub bootstrap_key_hash: [u8; 32],  // SHA256 hash of the bootstrap key (used for verification)
    pub key_store: Arc<ApiKeyStore>,    // User-created API keys
}

async fn extract_auth_header(
    req: http::Request<Body>,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let auth_header = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    
    let mut req = req;
    req.extensions_mut().insert(auth_header);
    
    next.run(req).await
}

fn derive_verification_key(bootstrap_key: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(bootstrap_key.as_bytes());
    hasher.update(b"audio-scope-view-system-verification"); // Domain separation
    hasher.finalize().into()
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
            return (None, true);  // System client, no specific API key
        }

        (None, false)
    }
}

async fn graphql_handler(
    State(state): State<Arc<AppState>>,
    axum::extract::Extension(auth_header): axum::extract::Extension<Option<String>>,
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
    info!("AUTH: OK - {}", auth_type);
    
    request = request.data(state.clone());
    request = request.data(state.context.clone());
    request = request.data(state.ws_state.clone());
    request = request.data(state.key_store.clone());
    request = request.data(ApiKeyAuth {
        key_info: api_key_info,
        is_system_client,
    });

    let response = state.graphql_schema.execute(request).await.into();
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

    let graphql_subscription = GraphQLSubscription::new(state.graphql_schema.clone());

    let auth_middleware = from_fn(extract_auth_header);

    let graphql_router = Router::new()
        .route(GRAPHQL_PATH, post(graphql_handler))
        .route(GRAPHQL_PLAYGROUND_PATH, get(playground_handler))
        .layer(auth_middleware)  // Apply auth extraction middleware
        .with_state(state.clone());

    let graphql_ws_router = Router::new()
        .route_service("/ws", graphql_subscription);

    let recordings_router = Router::new()
        .route("/api/recordings/{id}/samples", get(get_recording_samples))
        .route("/api/recordings/{id}/stream", get(stream_recording_pcm))
        .route("/api/recordings/{id}/metadata", get(get_recording_metadata))
        .with_state(state.clone());

    Router::new()
        .route(HEALTH_PATH, get(health_handler))
        .nest("/graphql", graphql_router)
        .merge(graphql_ws_router)
        .merge(recordings_router)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}

pub async fn start_server(
    address: &str,
    state: Arc<AppState>,
) -> Result<(), Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind(address).await?;

    info!("Server listening on http://{}", address);

    axum::serve(listener, build_router(state)).await?;

    Ok(())
}
