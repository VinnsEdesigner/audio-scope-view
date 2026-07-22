use std::sync::Arc;

use async_graphql::{Context, Object, Enum, InputObject, SimpleObject};
use sha2::{Sha256, Digest};

use crate::application::export_service::ExportService;
use crate::application::export_service::ExportFormat as AppExportFormat;
use crate::application::BatchCaptureSettings;
use crate::api::context_extractor::GraphqlContext;

/// Verify if the provided key matches the expected bootstrap key
/// Returns true if the SHA256 hash of the provided key matches the stored hash
fn verify_bootstrap_key(provided_key: &str, expected_hash: &[u8; 32]) -> bool {
    let mut hasher = Sha256::new();
    hasher.update(provided_key.as_bytes());
    hasher.update(b"audio-scope-view-system-verification");
    let provided_hash: [u8; 32] = hasher.finalize().into();
    provided_hash == *expected_hash
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum ExportFormat {
    Wav,
    Csv,
    Json,
}

impl From<AppExportFormat> for ExportFormat {
    fn from(format: AppExportFormat) -> Self {
        match format {
            AppExportFormat::Wav => Self::Wav,
            AppExportFormat::Csv => Self::Csv,
            AppExportFormat::Json => Self::Json,
        }
    }
}

impl From<ExportFormat> for AppExportFormat {
    fn from(format: ExportFormat) -> Self {
        match format {
            ExportFormat::Wav => Self::Wav,
            ExportFormat::Csv => Self::Csv,
            ExportFormat::Json => Self::Json,
        }
    }
}

#[derive(Debug, Clone, InputObject)]
pub struct BatchCaptureInput {
    pub scope_id: String,
    pub count: u32,
    pub interval_ms: u64,
    pub sample_rate: u32,
    pub samples_per_capture: usize,
}

#[derive(Debug, Clone, SimpleObject)]
pub struct BatchCaptureResult {
    pub total_duration_ms: u64,
    pub success_count: u32,
    pub failure_count: u32,
}

#[derive(Debug, Clone, SimpleObject)]
pub struct SimulationState {
    pub is_running: bool,
    pub is_paused: bool,
    pub current_index: usize,
    pub waveform_index: usize,
}

#[derive(Debug, Clone, InputObject)]
pub struct SimulationConfigInput {
    pub waveform_ids: Vec<String>,
    pub loop_enabled: bool,
    pub speed: f32,
    pub delay_between_ms: u64,
}

#[derive(Debug, Clone, SimpleObject)]
pub struct ExportResult {
    pub data: String,
    pub format: ExportFormat,
}

#[derive(Default)]
pub struct ExportQueryRoot;

#[Object]
impl ExportQueryRoot {
    async fn export_waveform(
        &self,
        ctx: &Context<'_>,
        waveform_id: String,
        format: ExportFormat,
    ) -> async_graphql::Result<ExportResult> {
        let context = ctx.data_unchecked::<GraphqlContext>();
        
        let waveform = context.waveform_service.get(&waveform_id)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to get waveform: {}", e)))?
            .ok_or_else(|| async_graphql::Error::new("Waveform not found"))?;

        let export_service = ExportService::new(44100);
        let data = export_service.export(&waveform, format.into())
            .map_err(|e| async_graphql::Error::new(format!("Export failed: {}", e)))?;

        let data_str = match format {
            ExportFormat::Json => String::from_utf8_lossy(&data).to_string(),
            _ => base64_encode(&data),
        };

        Ok(ExportResult {
            data: data_str,
            format,
        })
    }
}

fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    for chunk in data.chunks(3) {
        let b = match chunk.len() {
            1 => [chunk[0], 0, 0],
            2 => [chunk[0], chunk[1], 0],
            _ => [chunk[0], chunk[1], chunk[2]],
        };
        result.push(CHARS[(b[0] >> 2) as usize] as char);
        result.push(CHARS[((b[0] & 0x03) << 4 | b[1] >> 4) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((b[1] & 0x0f) << 2 | b[2] >> 6) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(b[2] & 0x3f) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

#[derive(Default)]
pub struct SimulationQueryRoot;

#[Object]
impl SimulationQueryRoot {
    async fn simulation_state(
        &self,
        ctx: &Context<'_>,
    ) -> async_graphql::Result<SimulationState> {
        let app_state = ctx.data_unchecked::<Arc<crate::api::server_graphql::AppState>>();
        let state = app_state.simulation_service.get_state().await;
        Ok(SimulationState {
            is_running: state.is_running,
            is_paused: state.is_paused,
            current_index: state.current_index,
            waveform_index: state.waveform_index,
        })
    }
}

#[derive(Default)]
pub struct BatchCaptureMutationRoot;

#[Object]
impl BatchCaptureMutationRoot {
    async fn start_batch_capture(
        &self,
        ctx: &Context<'_>,
        input: BatchCaptureInput,
    ) -> async_graphql::Result<BatchCaptureResult> {
        let app_state = ctx.data_unchecked::<Arc<crate::api::server_graphql::AppState>>();
        
        let settings = BatchCaptureSettings {
            scope_id: input.scope_id,
            count: input.count,
            interval_ms: input.interval_ms,
            sample_rate: input.sample_rate,
            samples_per_capture: input.samples_per_capture,
        };

        let result = app_state.batch_capture_service.capture_batch(settings)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Batch capture failed: {}", e)))?;

        Ok(BatchCaptureResult {
            total_duration_ms: result.total_duration_ms,
            success_count: result.success_count,
            failure_count: result.failure_count,
        })
    }
}

#[derive(Default)]
pub struct SimulationMutationRoot;

#[Object]
impl SimulationMutationRoot {
    async fn start_simulation(
        &self,
        ctx: &Context<'_>,
        config: SimulationConfigInput,
    ) -> async_graphql::Result<bool> {
        let app_state = ctx.data_unchecked::<Arc<crate::api::server_graphql::AppState>>();
        
        let sim_config = crate::application::simulation_service::SimulationConfig {
            waveform_ids: config.waveform_ids,
            loop_enabled: config.loop_enabled,
            speed: config.speed,
            delay_between_ms: config.delay_between_ms,
        };

        app_state.simulation_service.start_simulation(sim_config)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to start simulation: {}", e)))
    }

    async fn stop_simulation(&self, ctx: &Context<'_>) -> async_graphql::Result<bool> {
        let app_state = ctx.data_unchecked::<Arc<crate::api::server_graphql::AppState>>();
        app_state.simulation_service.stop_simulation()
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to stop simulation: {}", e)))
    }

    async fn pause_simulation(&self, ctx: &Context<'_>) -> async_graphql::Result<bool> {
        let app_state = ctx.data_unchecked::<Arc<crate::api::server_graphql::AppState>>();
        app_state.simulation_service.pause_simulation()
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to pause simulation: {}", e)))
    }

    async fn resume_simulation(&self, ctx: &Context<'_>) -> async_graphql::Result<bool> {
        let app_state = ctx.data_unchecked::<Arc<crate::api::server_graphql::AppState>>();
        app_state.simulation_service.resume_simulation()
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to resume simulation: {}", e)))
    }
}

// ============================================
// API Key Management Types & Resolvers
// ============================================

#[derive(Debug, Clone, SimpleObject)]
pub struct ApiKeyInfo {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub expires_at: Option<i64>,
    pub last_used_at: Option<i64>,
    pub rate_limit_per_minute: u32,
    pub is_valid: bool,
}

#[derive(Debug, Clone, SimpleObject)]
pub struct ApiKeyCreated {
    pub id: String,
    pub key: String,  // Only shown once at creation!
    pub name: String,
}

#[derive(Debug, Clone, SimpleObject)]
pub struct ApiKeyVerifyResult {
    pub valid: bool,
    pub key_id: Option<String>,
    pub name: Option<String>,
    pub rate_limit_per_minute: Option<u32>,
    pub expires_at: Option<i64>,
}

#[derive(Debug, Clone, InputObject)]
pub struct CreateApiKeyInput {
    pub name: String,
    pub expires_in_hours: Option<i32>,
    pub rate_limit_per_minute: Option<i32>,
}

#[derive(Debug, Clone, InputObject)]
pub struct UpdateApiKeyInput {
    pub name: Option<String>,
    pub rate_limit_per_minute: Option<i32>,
    pub expires_in_hours: Option<i32>,
}

#[derive(Default)]
pub struct ApiKeyQueryRoot;

#[Object]
impl ApiKeyQueryRoot {
    /// List all API keys (without showing the actual key values)
    async fn api_keys(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<ApiKeyInfo>> {
        let key_store = ctx.data_unchecked::<Arc<crate::api::auth::ApiKeyStore>>();
        let keys = key_store.list_keys().await;
        
        Ok(keys.into_iter().map(|k| ApiKeyInfo {
            id: k.id,
            name: k.name,
            created_at: k.created_at.elapsed().as_secs() as i64,
            expires_at: k.expires_at.map(|e| e.elapsed().as_secs() as i64),
            last_used_at: k.last_used_at.map(|l| l.elapsed().as_secs() as i64),
            rate_limit_per_minute: k.rate_limit_per_minute,
            is_valid: k.expires_at.is_none_or(|exp| exp > std::time::Instant::now()),
        }).collect())
    }

    /// Get info about a specific API key
    async fn api_key(&self, ctx: &Context<'_>, id: String) -> async_graphql::Result<Option<ApiKeyInfo>> {
        let key_store = ctx.data_unchecked::<Arc<crate::api::auth::ApiKeyStore>>();
        
        if let Some(k) = key_store.get_key_info(&id).await {
            let is_valid = k.expires_at.is_none_or(|exp| exp > std::time::Instant::now());
            Ok(Some(ApiKeyInfo {
                id: k.id,
                name: k.name,
                created_at: k.created_at.elapsed().as_secs() as i64,
                expires_at: k.expires_at.map(|e| e.elapsed().as_secs() as i64),
                last_used_at: k.last_used_at.map(|l| l.elapsed().as_secs() as i64),
                rate_limit_per_minute: k.rate_limit_per_minute,
                is_valid,
            }))
        } else {
            Ok(None)
        }
    }

    /// Verify an API key is valid (does NOT mark as used)
    async fn verify_api_key(&self, ctx: &Context<'_>, key: String) -> async_graphql::Result<ApiKeyVerifyResult> {
        let key_store = ctx.data_unchecked::<Arc<crate::api::auth::ApiKeyStore>>();
        
        // Check if it's the bootstrap key (using hash verification)
        let app_state = ctx.data_unchecked::<Arc<crate::api::server_graphql::AppState>>();
        if verify_bootstrap_key(&key, &app_state.bootstrap_key_hash) {
            return Ok(ApiKeyVerifyResult {
                valid: true,
                key_id: None,
                name: Some("Bootstrap Key (System)".to_string()),
                rate_limit_per_minute: None,
                expires_at: None,
            });
        }
        
        // Try user API keys
        if let Some(api_key) = key_store.validate(&key).await {
            return Ok(ApiKeyVerifyResult {
                valid: true,
                key_id: Some(api_key.id),
                name: Some(api_key.name),
                rate_limit_per_minute: Some(api_key.rate_limit_per_minute),
                expires_at: api_key.expires_at.map(|e| e.elapsed().as_secs() as i64),
            });
        }
        
        Ok(ApiKeyVerifyResult {
            valid: false,
            key_id: None,
            name: None,
            rate_limit_per_minute: None,
            expires_at: None,
        })
    }
}

#[derive(Default)]
pub struct ApiKeyMutationRoot;

#[Object]
impl ApiKeyMutationRoot {
    /// Create a new API key - the key is only shown once!
    async fn create_api_key(
        &self,
        ctx: &Context<'_>,
        input: CreateApiKeyInput,
    ) -> async_graphql::Result<ApiKeyCreated> {
        let key_store = ctx.data_unchecked::<Arc<crate::api::auth::ApiKeyStore>>();
        
        let api_key = if let Some(hours) = input.expires_in_hours {
            let duration = std::time::Duration::from_secs((hours as u64) * 3600);
            key_store.create_key_with_expiry(input.name, duration).await
        } else {
            key_store.create_key(input.name).await
        };

        // Apply custom rate limit if specified
        if let Some(limit) = input.rate_limit_per_minute {
            key_store.update_key_rate_limit(&api_key.id, limit as u32).await;
        }

        Ok(ApiKeyCreated {
            id: api_key.id,
            key: api_key.key, // Only returned here once!
            name: api_key.name,
        })
    }

    /// Update an API key (name, rate limit, expiry)
    async fn update_api_key(
        &self,
        ctx: &Context<'_>,
        id: String,
        input: UpdateApiKeyInput,
    ) -> async_graphql::Result<bool> {
        let key_store = ctx.data_unchecked::<Arc<crate::api::auth::ApiKeyStore>>();
        
        // Update name if specified
        if let Some(ref name) = input.name {
            key_store.update_key_name(&id, name).await;
        }
        
        // Update rate limit if specified
        if let Some(limit) = input.rate_limit_per_minute {
            key_store.update_key_rate_limit(&id, limit as u32).await;
        }
        
        // Update expiry if specified
        if let Some(hours) = input.expires_in_hours {
            let duration = std::time::Duration::from_secs((hours as u64) * 3600);
            key_store.update_key_expiry(&id, duration).await;
        }
        
        Ok(true)
    }

    /// Delete/Revoke an API key
    async fn delete_api_key(
        &self,
        ctx: &Context<'_>,
        id: String,
    ) -> async_graphql::Result<bool> {
        let key_store = ctx.data_unchecked::<Arc<crate::api::auth::ApiKeyStore>>();
        let deleted = key_store.delete_key(&id).await;
        Ok(deleted)
    }
}
