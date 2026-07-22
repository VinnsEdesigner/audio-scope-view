
#![allow(dead_code)]

use std::sync::Arc;

use async_graphql::http::GraphiQLSource;
use async_graphql_axum::{GraphQLRequest, GraphQLResponse, GraphQLSubscription};
use axum::{
    body::Body,
    response::Html,
    Json, Router,
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
use crate::api::schema_root::build_schema;
use crate::api::websocket::handler::WsState;
use crate::application::{BatchCaptureService, DashboardService, ScopeService, SettingsService, SimulationService, WaveformService};
use crate::shared::constants::{GRAPHQL_PATH, GRAPHQL_PLAYGROUND_PATH, HEALTH_PATH};

/// Authentication info passed to resolvers
pub struct ApiKeyAuth {
    pub key_info: Option<ApiKey>,
    pub is_system_client: bool,  // True if verified via bootstrap key (AES256 hash match)
}

/// Application state
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
    pub bootstrap_key_hash: [u8; 32],  // SHA256 hash of the bootstrap key (used for verification)
    pub key_store: Arc<ApiKeyStore>,    // User-created API keys
}

/// Health check response
#[derive(serde::Serialize)]
struct HealthResponse {
    status: String,
    version: String,
}

/// Middleware to extract Authorization header and add to request extensions
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

/// Derive the verification key from bootstrap key using AES256-GCM
/// The system verifies clients by hashing their incoming key with SHA256 and comparing to expected hash
fn derive_verification_key(bootstrap_key: &str) -> [u8; 32] {
    // Use SHA256 to derive a consistent 32-byte key from the bootstrap key
    // This is the expected hash that clients must produce
    let mut hasher = Sha256::new();
    hasher.update(bootstrap_key.as_bytes());
    hasher.update(b"audio-scope-view-system-verification"); // Domain separation
    hasher.finalize().into()
}

/// Verify if the provided key matches the expected bootstrap key
/// Returns true if the SHA256 hash of the provided key matches the stored hash
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
        scope_service: Arc<ScopeService>,
        settings_service: Arc<SettingsService>,
        dashboard_service: Arc<DashboardService>,
        waveform_service: Arc<WaveformService>,
        simulation_service: Arc<SimulationService>,
        batch_capture_service: Arc<BatchCaptureService>,
        bootstrap_key: String,
        key_store: Arc<ApiKeyStore>,
    ) -> Self {
        let context = GraphqlContext::new(
            scope_service,
            settings_service,
            dashboard_service,
            waveform_service,
        );

        let schema = build_schema();
        let ws_state = Arc::new(WsState::new());
        
        // Derive the verification hash from the bootstrap key
        let bootstrap_key_hash = derive_verification_key(&bootstrap_key);

        Self {
            graphql_schema: schema,
            context,
            ws_state,
            simulation_service,
            batch_capture_service,
            bootstrap_key_hash,
            key_store,
        }
    }

    /// Get WebSocket state for building routers
    pub fn ws_state(&self) -> Arc<WsState> {
        self.ws_state.clone()
    }

    /// Validate an API key from Authorization header
    /// Returns (Some(api_key), false) for user API keys
    /// Returns (None, true) for verified system client (bootstrap key hash match)
    /// Returns (None, false) for invalid keys
    pub async fn validate_api_key(&self, auth_header: Option<&str>) -> (Option<ApiKey>, bool) {
        let header = match auth_header {
            Some(h) => h,
            None => return (None, false),
        };

        // Check if it's a Bearer token
        let key = if let Some(stripped) = header.strip_prefix("Bearer ") {
            stripped
        } else {
            header
        };

        // First, try user API keys (these are for other developers)
        if let Some(api_key) = self.key_store.validate(key).await {
            return (Some(api_key), false);
        }

        // Then verify against bootstrap key hash (this is the system client)
        if verify_bootstrap_key(key, &self.bootstrap_key_hash) {
            return (None, true);  // System client, no specific API key
        }

        (None, false)
    }
}

/// GraphQL handler (HTTP) with authentication
/// Extracts Authorization header and validates API key
async fn graphql_handler(
    State(state): State<Arc<AppState>>,
    axum::extract::Extension(auth_header): axum::extract::Extension<Option<String>>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    let mut request = req.into_inner();
    
    // Log incoming request
    info!("REQUEST: POST /graphql");
    
    // Validate the API key
    let (api_key_info, is_system_client) = state.validate_api_key(auth_header.as_deref()).await;
    
    // If no valid key and not system client, return unauthorized error
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
    
    // Pass auth info to resolvers
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

/// Health check handler (no auth required)
async fn health_handler() -> impl IntoResponse {
    info!("REQUEST: GET /health");
    info!("RESPONSE: 200 OK");
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// GraphQL playground handler
async fn playground_handler() -> impl IntoResponse {
    Html(
        GraphiQLSource::build()
            .endpoint("/graphql")
            .subscription_endpoint("/graphql/ws")
            .finish(),
    )
}

/// Build the application router with proper GraphQL WebSocket subscription support
pub fn build_router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Create GraphQL subscription service using the schema as executor
    let graphql_subscription = GraphQLSubscription::new(state.graphql_schema.clone());

    // Create the auth middleware with state
    let auth_middleware = from_fn(extract_auth_header);

    let graphql_router = Router::new()
        .route(GRAPHQL_PATH, post(graphql_handler))
        .route(GRAPHQL_PLAYGROUND_PATH, get(playground_handler))
        .route(HEALTH_PATH, get(health_handler))
        .layer(auth_middleware)  // Apply auth extraction middleware
        .with_state(state.clone());

    // WebSocket for GraphQL subscriptions (no auth for WS - handled at protocol level)
    let graphql_ws_router = Router::new()
        .route_service("/ws", graphql_subscription);

    Router::new()
        .nest("/graphql", graphql_router)
        .merge(graphql_ws_router)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}

/// Start the GraphQL server
pub async fn start_server(
    address: &str,
    state: Arc<AppState>,
) -> Result<(), Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind(address).await?;

    info!("Server listening on http://{}", address);

    axum::serve(listener, build_router(state)).await?;

    Ok(())
}
