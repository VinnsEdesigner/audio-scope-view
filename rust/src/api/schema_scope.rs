//! Scope GraphQL schema

use async_graphql::{Context, InputObject, Object, SimpleObject};
use chrono::Utc;

use crate::api::context_extractor::GraphqlContext;
use crate::domain::Scope;
use crate::domain::trait_audio_capture::AudioCapture;
use crate::infrastructure::audio_capture_mock::MockAudioCapture;

/// Scope output type
#[derive(Debug, SimpleObject)]
pub struct ScopeOutput {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub sample_rate: u32,
    pub buffer_size: u32,
    pub created_at: String,
    pub updated_at: String,
}

impl From<Scope> for ScopeOutput {
    fn from(scope: Scope) -> Self {
        Self {
            id: scope.id,
            name: scope.name,
            description: scope.description,
            is_active: scope.is_active,
            sample_rate: scope.sample_rate,
            buffer_size: scope.buffer_size,
            created_at: scope.created_at.to_rfc3339(),
            updated_at: scope.updated_at.to_rfc3339(),
        }
    }
}

/// Input for audio capture settings
#[derive(Debug, InputObject)]
pub struct CaptureSettingsInput {
    pub frequency: Option<f64>,   // Hz, default 440
    pub amplitude: Option<f32>,   // 0.0-1.0, default 0.5
    pub noise_level: Option<f32>, // 0.0-1.0, default 0.02
    pub duration_ms: Option<u32>, // Capture duration in ms, default 100
}

/// Scope query operations
#[derive(Default)]
pub struct ScopeQuery;

#[Object]
impl ScopeQuery {
    /// Get all scopes with pagination
    async fn scopes(
        &self,
        ctx: &Context<'_>,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> Vec<ScopeOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        let limit = limit.unwrap_or(20).clamp(1, 100) as u32;
        let offset = offset.unwrap_or(0).max(0) as u32;

        context
            .scope_service
            .list(limit, offset)
            .await
            .map(|scopes| scopes.into_iter().map(ScopeOutput::from).collect())
            .unwrap_or_default()
    }

    /// Get scope by ID
    async fn scope(&self, ctx: &Context<'_>, id: String) -> Option<ScopeOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context
            .scope_service
            .get(&id)
            .await
            .ok()
            .flatten()
            .map(ScopeOutput::from)
    }

    /// Get all active scopes
    async fn active_scopes(&self, ctx: &Context<'_>) -> Vec<ScopeOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context
            .scope_service
            .get_active()
            .await
            .map(|scopes| scopes.into_iter().map(ScopeOutput::from).collect())
            .unwrap_or_default()
    }

    /// Get total scope count
    async fn scope_count(&self, ctx: &Context<'_>) -> i32 {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context.scope_service.count().await.unwrap_or(0) as i32
    }
}

/// Scope mutation operations
#[derive(Default)]
pub struct ScopeMutation;

#[Object]
impl ScopeMutation {
    /// Create a new scope
    async fn create_scope(&self, ctx: &Context<'_>, name: String) -> ScopeOutput {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context
            .scope_service
            .create(name)
            .await
            .map(ScopeOutput::from)
            .unwrap_or_else(|_| {
                // Return a placeholder if creation fails
                ScopeOutput {
                    id: uuid::Uuid::new_v4().to_string(),
                    name: "New Scope".to_string(),
                    description: None,
                    is_active: true,
                    sample_rate: 44100,
                    buffer_size: 1024,
                    created_at: chrono::Utc::now().to_rfc3339(),
                    updated_at: chrono::Utc::now().to_rfc3339(),
                }
            })
    }

    /// Update a scope
    #[allow(clippy::too_many_arguments)]
    async fn update_scope(
        &self,
        ctx: &Context<'_>,
        id: String,
        name: Option<String>,
        description: Option<String>,
        sample_rate: Option<u32>,
        buffer_size: Option<u32>,
        is_active: Option<bool>,
    ) -> Option<ScopeOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        // Get existing scope
        let mut scope = context.scope_service.get(&id).await.ok().flatten()?;

        // Update fields
        if let Some(n) = name {
            scope.name = n;
        }
        if let Some(d) = description {
            scope.description = Some(d);
        }
        if let Some(sr) = sample_rate {
            scope.sample_rate = sr;
        }
        if let Some(bs) = buffer_size {
            scope.buffer_size = bs;
        }
        if let Some(active) = is_active {
            scope.is_active = active;
        }
        scope.updated_at = chrono::Utc::now();

        // Save and return
        context.scope_service.update(scope.clone()).await.ok()?;
        Some(ScopeOutput::from(scope))
    }

    /// Delete a scope
    async fn delete_scope(&self, ctx: &Context<'_>, id: String) -> bool {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context.scope_service.delete(&id).await.is_ok()
    }

    /// Capture audio and create a waveform
    /// Uses mock audio generation for testing
    async fn capture(
        &self,
        ctx: &Context<'_>,
        scope_id: String,
        settings: Option<CaptureSettingsInput>,
    ) -> Option<crate::api::schema_waveform::WaveformOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        // Get scope to verify it exists
        let scope = context.scope_service.get(&scope_id).await.ok().flatten()?;

        // Get capture settings
        let capture_settings = settings.unwrap_or(CaptureSettingsInput {
            frequency: Some(440.0),
            amplitude: Some(0.5),
            noise_level: Some(0.02),
            duration_ms: Some(100),
        });

        // Create mock audio capture with settings
        let mut capture = MockAudioCapture::new()
            .with_sample_rate(scope.sample_rate)
            .with_frequency(capture_settings.frequency.unwrap_or(440.0))
            .with_amplitude(capture_settings.amplitude.unwrap_or(0.5))
            .with_noise(capture_settings.noise_level.unwrap_or(0.02));

        // Calculate number of samples
        let duration_ms = capture_settings.duration_ms.unwrap_or(100) as usize;
        let num_samples = (scope.sample_rate as usize * duration_ms) / 1000;
        let mut buffer = vec![0.0f32; num_samples];

        // Start capture and read samples
        if capture.start(None).await.is_err() {
            return None;
        }

        let _ = capture.read_samples(&mut buffer).await;
        let _ = capture.stop().await;

        // Create waveform
        let waveform = crate::domain::Waveform::new(
            uuid::Uuid::new_v4().to_string(),
            scope_id,
            buffer,
            Utc::now(),
        );

        // Save waveform
        context
            .waveform_service
            .save(waveform)
            .await
            .ok()
            .map(crate::api::schema_waveform::WaveformOutput::from)
    }
}
