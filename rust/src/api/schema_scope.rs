//! Session GraphQL schema - Ephemeral canvas tracking

use async_graphql::{Context, InputObject, Object, SimpleObject};
use chrono::Utc;

use crate::api::context_extractor::GraphqlContext;
use crate::domain::Session;
use crate::domain::trait_audio_capture::AudioCapture;
use crate::infrastructure::audio_capture_mock::MockAudioCapture;

/// Session output type
#[derive(Debug, SimpleObject)]
pub struct SessionOutput {
    pub id: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_seconds: Option<i64>,
    /// Number of recordings created during this session
    pub recording_count: i64,
}

impl SessionOutput {
    /// Create SessionOutput from Session without recording count
    fn from_session(session: Session) -> Self {
        Self {
            id: session.id,
            started_at: session.started_at.to_rfc3339(),
            ended_at: session.ended_at.map(|dt| dt.to_rfc3339()),
            duration_seconds: session.duration_seconds,
            recording_count: 0,
        }
    }

    /// Create SessionOutput from Session with recording count
    pub fn from_session_with_count(session: Session, recording_count: i64) -> Self {
        Self {
            id: session.id,
            started_at: session.started_at.to_rfc3339(),
            ended_at: session.ended_at.map(|dt| dt.to_rfc3339()),
            duration_seconds: session.duration_seconds,
            recording_count,
        }
    }
}

impl From<Session> for SessionOutput {
    fn from(session: Session) -> Self {
        Self::from_session(session)
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

/// Session query operations
#[derive(Default)]
pub struct SessionQuery;

#[Object]
impl SessionQuery {
    /// Get all sessions with pagination
    async fn sessions(
        &self,
        ctx: &Context<'_>,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> Vec<SessionOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        let limit = limit.unwrap_or(20).clamp(1, 100) as u32;
        let offset = offset.unwrap_or(0).max(0) as u32;

        let sessions = context
            .session_service
            .list(limit, offset)
            .await
            .unwrap_or_default();

        // Get recording counts for each session
        let mut results: Vec<SessionOutput> = Vec::new();
        for session in sessions {
            let count = context
                .recording_service
                .get_recording_count_for_scope(&session.id)
                .await
                .unwrap_or(0);
            results.push(SessionOutput::from_session_with_count(session, count as i64));
        }
        results
    }

    /// Get session by ID
    async fn session(&self, ctx: &Context<'_>, id: String) -> Option<SessionOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        let session = context
            .session_service
            .get(&id)
            .await
            .ok()
            .flatten()?;

        let count = context
            .recording_service
            .get_recording_count_for_scope(&session.id)
            .await
            .unwrap_or(0);

        Some(SessionOutput::from_session_with_count(session, count as i64))
    }

    /// Get total session count
    async fn session_count(&self, ctx: &Context<'_>) -> i32 {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context.session_service.count().await.unwrap_or(0) as i32
    }
}

/// Session mutation operations
#[derive(Default)]
pub struct SessionMutation;

#[Object]
impl SessionMutation {
    /// Create a new session (auto-called when canvas opens)
    async fn create_session(&self, ctx: &Context<'_>) -> SessionOutput {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context
            .session_service
            .create_session()
            .await
            .map(SessionOutput::from)
            .unwrap_or_else(|_| {
                SessionOutput {
                    id: uuid::Uuid::new_v4().to_string(),
                    started_at: chrono::Utc::now().to_rfc3339(),
                    ended_at: None,
                    duration_seconds: None,
                    recording_count: 0,
                }
            })
    }

    /// End a session
    async fn end_session(&self, ctx: &Context<'_>, id: String) -> Option<SessionOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context.session_service.end_session(&id).await.ok().map(SessionOutput::from)
    }

    /// Heartbeat to keep session alive
    async fn session_heartbeat(&self, ctx: &Context<'_>, id: String) -> bool {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context.session_service.heartbeat(&id).await.is_ok()
    }

    /// Delete a session
    async fn delete_session(&self, ctx: &Context<'_>, id: String) -> bool {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context.session_service.delete(&id).await.is_ok()
    }

    /// Capture audio and create a waveform
    /// Uses mock audio generation for testing
    async fn capture(
        &self,
        ctx: &Context<'_>,
        session_id: String,
        settings: Option<CaptureSettingsInput>,
    ) -> Option<crate::api::schema_waveform::WaveformOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        // Verify session exists
        let _session = context.session_service.get(&session_id).await.ok().flatten()?;

        // Default capture settings
        let capture_settings = settings.unwrap_or(CaptureSettingsInput {
            frequency: Some(440.0),
            amplitude: Some(0.5),
            noise_level: Some(0.02),
            duration_ms: Some(100),
        });

        // Create mock audio capture with settings
        let mut capture = MockAudioCapture::new()
            .with_sample_rate(44100) // Default sample rate for session
            .with_frequency(capture_settings.frequency.unwrap_or(440.0))
            .with_amplitude(capture_settings.amplitude.unwrap_or(0.5))
            .with_noise(capture_settings.noise_level.unwrap_or(0.02));

        // Calculate number of samples
        let duration_ms = capture_settings.duration_ms.unwrap_or(100) as usize;
        let sample_rate = 44100u32;
        let num_samples = (sample_rate as usize * duration_ms) / 1000;
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
            session_id,
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
