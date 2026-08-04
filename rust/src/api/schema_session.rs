
use async_graphql::{Context, InputObject, Object, SimpleObject};
use chrono::Utc;

use crate::api::context_extractor::GraphqlContext;
use crate::domain::Session;
use crate::domain::trait_audio_capture::AudioCapture;
use crate::infrastructure::audio_capture_mock::MockAudioCapture;

#[derive(Debug, Clone, Copy, PartialEq, Eq, async_graphql::Enum)]
pub enum SessionStatus {
    Live,
    Paused,
    Offline,
}

impl From<&Session> for SessionStatus {
    fn from(session: &Session) -> Self {
        if session.ended_at.is_some() {
            SessionStatus::Offline
        } else if session.is_oscilloscope_open() {
            SessionStatus::Live
        } else {
            SessionStatus::Paused
        }
    }
}

#[derive(Debug, SimpleObject)]
pub struct SessionWithStatusOutput {
    pub id: String,
    pub name: String,
    pub started_at: String,
    pub status: SessionStatus,
    pub recording_count: i64,
}

#[derive(Debug, SimpleObject)]
pub struct SessionsWithStatusOutput {
    pub sessions: Vec<SessionWithStatusOutput>,
    pub total: i64,
    pub has_more: bool,
}

#[derive(Debug, SimpleObject)]
pub struct SessionStatusCountsOutput {
    pub live_count: i32,
    pub paused_count: i32,
    pub offline_count: i32,
    pub total: i32,
}

#[derive(Debug, SimpleObject)]
pub struct SessionOutput {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_seconds: Option<i64>,
    pub recording_count: i64,
    pub is_oscilloscope_open: bool,
    pub oscilloscope_duration_ms: Option<f64>,
    pub parent_session_id: Option<String>,
    pub is_sub_session: bool,
    pub sub_session_count: i32,
    pub auto_close_timeout_secs: Option<i32>,
    pub peak_amplitude: Option<f32>,
    pub rms_amplitude: Option<f32>,
    pub dc_offset: Option<f32>,
    pub dominant_frequency: Option<f32>,
    pub frequency_high: Option<f32>,
    pub frequency_low: Option<f32>,
}

impl SessionOutput {
    fn from_session(session: Session) -> Self {
        let is_oscilloscope_open = session.is_oscilloscope_open();
        let oscilloscope_duration_ms = session.oscilloscope_duration_ms;
        Self {
            id: session.id,
            name: session.name,
            description: session.description,
            started_at: session.started_at.to_rfc3339(),
            ended_at: session.ended_at.map(|dt| dt.to_rfc3339()),
            duration_seconds: session.duration_seconds,
            recording_count: 0,
            is_oscilloscope_open,
            oscilloscope_duration_ms,
            parent_session_id: session.parent_session_id,
            is_sub_session: session.is_sub_session,
            sub_session_count: 0,
            auto_close_timeout_secs: session.auto_close_timeout_secs,
            peak_amplitude: session.peak_amplitude,
            rms_amplitude: session.rms_amplitude,
            dc_offset: session.dc_offset,
            dominant_frequency: session.dominant_frequency,
            frequency_high: session.frequency_high,
            frequency_low: session.frequency_low,
        }
    }

    pub fn from_session_with_count(session: Session, recording_count: i64) -> Self {
        Self::from_session_full(session, recording_count, 0)
    }

    pub fn from_session_full(
        session: Session,
        recording_count: i64,
        sub_session_count: i32,
    ) -> Self {
        let is_oscilloscope_open = session.is_oscilloscope_open();
        let oscilloscope_duration_ms = session.oscilloscope_duration_ms;
        Self {
            id: session.id,
            name: session.name,
            description: session.description,
            started_at: session.started_at.to_rfc3339(),
            ended_at: session.ended_at.map(|dt| dt.to_rfc3339()),
            duration_seconds: session.duration_seconds,
            recording_count,
            is_oscilloscope_open,
            oscilloscope_duration_ms,
            parent_session_id: session.parent_session_id,
            is_sub_session: session.is_sub_session,
            sub_session_count,
            auto_close_timeout_secs: session.auto_close_timeout_secs,
            peak_amplitude: session.peak_amplitude,
            rms_amplitude: session.rms_amplitude,
            dc_offset: session.dc_offset,
            dominant_frequency: session.dominant_frequency,
            frequency_high: session.frequency_high,
            frequency_low: session.frequency_low,
        }
    }
}

impl From<Session> for SessionOutput {
    fn from(session: Session) -> Self {
        Self::from_session(session)
    }
}

fn validate_session_name(name: &str) -> Result<(), String> {
    // Check for empty or whitespace-only
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Session name cannot be empty".to_string());
    }
    
    // Check for whitespace-only (after trimming)
    if trimmed != name {
        return Err("Session name cannot have leading or trailing whitespace".to_string());
    }
    
    // Check length (min 1, max 255)
    if trimmed.len() > 255 {
        return Err("Session name cannot exceed 255 characters".to_string());
    }
    
    // Allow only alphanumeric, spaces, hyphens, underscores
    for c in trimmed.chars() {
        if !c.is_alphanumeric() && c != ' ' && c != '-' && c != '_' {
            return Err(format!(
                "Session name contains invalid character '{}'. Only letters, numbers, spaces, hyphens, and underscores are allowed",
                c
            ));
        }
    }
    
    Ok(())
}

#[derive(Debug, InputObject)]
pub struct CreateSessionInput {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, InputObject)]
pub struct UpdateSessionInput {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, InputObject)]
pub struct UpdateSessionDspInput {
    pub peak_amplitude: Option<f32>,
    pub rms_amplitude: Option<f32>,
    pub dc_offset: Option<f32>,
    pub dominant_frequency: Option<f32>,
    pub frequency_high: Option<f32>,
    pub frequency_low: Option<f32>,
}

#[derive(Debug, InputObject)]
pub struct CaptureSettingsInput {
    pub frequency: Option<f64>,       pub amplitude: Option<f32>,       pub noise_level: Option<f32>,     pub duration_ms: Option<u32>, }

#[derive(Default)]
pub struct SessionQuery;

#[Object]
impl SessionQuery {
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
            .list_main_sessions(limit, offset)
            .await
            .unwrap_or_default();

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

    async fn session_count(&self, ctx: &Context<'_>) -> i32 {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context.session_service.count().await.unwrap_or(0) as i32
    }

    async fn active_sessions(&self, ctx: &Context<'_>) -> Vec<SessionOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        let sessions = context
            .session_service
            .list_main_sessions(100, 0)
            .await
            .unwrap_or_default();

        let mut results = Vec::new();
        for session in sessions.into_iter().filter(|s| s.is_active()) {
            let count = context
                .recording_service
                .get_recording_count_for_scope(&session.id)
                .await
                .unwrap_or(0);
            results.push(SessionOutput::from_session_with_count(session, count as i64));
        }
        results
    }

    async fn sub_sessions(
        &self,
        ctx: &Context<'_>,
        parent_id: String,
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
            .get_sub_sessions_paginated(&parent_id, limit, offset)
            .await
            .unwrap_or_default();

        let mut results: Vec<SessionOutput> = Vec::new();
        for session in sessions {
            let count = context
                .recording_service
                .get_recording_count_for_scope(&session.id)
                .await
                .unwrap_or(0) as i64;
            results.push(SessionOutput::from_session_with_count(session, count));
        }
        results
    }

    async fn parent_session(&self, ctx: &Context<'_>, sub_session_id: String) -> Option<SessionOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        let parent_opt = context
            .session_service
            .get_parent_session(&sub_session_id)
            .await
            .ok()
            .flatten();

        if let Some(session) = parent_opt {
            let count = context
                .recording_service
                .get_recording_count_for_scope(&session.id)
                .await
                .unwrap_or(0) as i64;
            Some(SessionOutput::from_session_with_count(session, count))
        } else {
            None
        }
    }

    async fn sessions_with_status(
        &self,
        ctx: &Context<'_>,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> SessionsWithStatusOutput {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        let limit = limit.unwrap_or(20).clamp(1, 100) as u32;
        let offset = offset.unwrap_or(0).max(0) as u32;
        let total_limit = 1000u32;
        let sessions = context
            .session_service
            .list_main_sessions(total_limit, 0)
            .await
            .unwrap_or_default();

        let total = sessions.len() as i64;
        let mut sessions_with_status = Vec::new();

        for session in sessions.into_iter().skip(offset as usize).take(limit as usize) {
            let count = context
                .recording_service
                .get_recording_count_for_scope(&session.id)
                .await
                .unwrap_or(0);

            sessions_with_status.push(SessionWithStatusOutput {
                id: session.id.clone(),
                name: format!("Session {}", &session.id[..8]),
                started_at: session.started_at.to_rfc3339(),
                status: SessionStatus::from(&session),
                recording_count: count as i64,
            });
        }

        let has_more = (offset as i64 + limit as i64) < total;

        SessionsWithStatusOutput {
            sessions: sessions_with_status,
            total,
            has_more,
        }
    }

    async fn active_sessions_with_status(&self, ctx: &Context<'_>) -> Vec<SessionWithStatusOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        let sessions = context
            .session_service
            .list_main_sessions(100, 0)
            .await
            .unwrap_or_default();

        let mut results = Vec::new();

        for session in sessions.into_iter().filter(|s| s.is_active()) {
            let count = context
                .recording_service
                .get_recording_count_for_scope(&session.id)
                .await
                .unwrap_or(0);

            results.push(SessionWithStatusOutput {
                id: session.id.clone(),
                name: format!("Session {}", &session.id[..8]),
                started_at: session.started_at.to_rfc3339(),
                status: SessionStatus::from(&session),
                recording_count: count as i64,
            });
        }

        results
    }

    async fn session_status_counts(&self, ctx: &Context<'_>) -> SessionStatusCountsOutput {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        let sessions = context
            .session_service
            .list_main_sessions(1000, 0)
            .await
            .unwrap_or_default();

        let mut live_count = 0i32;
        let mut paused_count = 0i32;
        let mut offline_count = 0i32;

        for session in sessions {
            match SessionStatus::from(&session) {
                SessionStatus::Live => live_count += 1,
                SessionStatus::Paused => paused_count += 1,
                SessionStatus::Offline => offline_count += 1,
            }
        }

        let total = live_count + paused_count + offline_count;

        SessionStatusCountsOutput {
            live_count,
            paused_count,
            offline_count,
            total,
        }
    }
}

#[derive(Default)]
pub struct SessionMutation;

#[Object]
impl SessionMutation {
    async fn create_session(
        &self,
        ctx: &Context<'_>,
        input: CreateSessionInput,
    ) -> Result<SessionOutput, async_graphql::Error> {
        // Validate session name
        validate_session_name(&input.name)
            .map_err(|e| async_graphql::Error::new(e))?;

        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;

        let session = context
            .session_service
            .create_named_session(input.name, input.description)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to create session: {:?}", e)))?;

        Ok(SessionOutput::from(session))
    }

    async fn create_named_session(
        &self,
        ctx: &Context<'_>,
        input: CreateSessionInput,
    ) -> Result<SessionOutput, async_graphql::Error> {
        // Validate session name
        validate_session_name(&input.name)
            .map_err(|e| async_graphql::Error::new(e))?;

        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;

        let session = context
            .session_service
            .create_named_session(input.name, input.description)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to create named session: {:?}", e)))?;

        Ok(SessionOutput::from(session))
    }

    async fn create_sub_session(
        &self,
        ctx: &Context<'_>,
        parent_id: String,
    ) -> Result<SessionOutput, async_graphql::Error> {
        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;

        let session = context
            .session_service
            .create_sub_session(&parent_id)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to create sub-session: {:?}", e)))?;

        Ok(SessionOutput::from(session))
    }

    async fn update_session(
        &self,
        ctx: &Context<'_>,
        id: String,
        input: UpdateSessionInput,
    ) -> Result<Option<SessionOutput>, async_graphql::Error> {
        // Validate session name if provided
        if let Some(ref name) = input.name {
            validate_session_name(name)
                .map_err(|e| async_graphql::Error::new(e))?;
        }

        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;

        let session = context
            .session_service
            .update_session_metadata(&id, input.name, input.description)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to update session: {:?}", e)))?;

        let count = context
            .recording_service
            .get_recording_count_for_scope(&session.id)
            .await
            .unwrap_or(0) as i64;

        Ok(Some(SessionOutput::from_session_with_count(session, count)))
    }

    async fn get_or_create_session(&self, ctx: &Context<'_>) -> Result<SessionOutput, async_graphql::Error> {
        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;

        let session = context
            .session_service
            .get_or_create_active_session()
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to get or create session: {:?}", e)))?;

        Ok(SessionOutput::from(session))
    }

    async fn end_session(&self, ctx: &Context<'_>, id: String) -> Result<Option<SessionOutput>, async_graphql::Error> {
        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;

        let session = context
            .session_service
            .end_session(&id)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to end session: {:?}", e)))?;

        Ok(Some(SessionOutput::from(session)))
    }

    async fn session_heartbeat(&self, ctx: &Context<'_>, id: String) -> Result<bool, async_graphql::Error> {
        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;

        context
            .session_service
            .heartbeat(&id)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to send heartbeat: {:?}", e)))?;

        Ok(true)
    }

    async fn delete_session(&self, ctx: &Context<'_>, id: String) -> Result<bool, async_graphql::Error> {
        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;

        context
            .session_service
            .delete(&id)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to delete session: {:?}", e)))
    }

    async fn open_oscilloscope(&self, ctx: &Context<'_>, session_id: String) -> Result<Option<SessionOutput>, async_graphql::Error> {
        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;

        let session = context
            .session_service
            .open_oscilloscope(&session_id)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to open oscilloscope: {:?}", e)))?;

        Ok(Some(SessionOutput::from(session)))
    }

    async fn close_oscilloscope(&self, ctx: &Context<'_>, session_id: String) -> Result<Option<SessionOutput>, async_graphql::Error> {
        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;

        let session = context
            .session_service
            .close_oscilloscope(&session_id)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to close oscilloscope: {:?}", e)))?;

        Ok(Some(SessionOutput::from(session)))
    }

    async fn capture(
        &self,
        ctx: &Context<'_>,
        session_id: String,
        settings: Option<CaptureSettingsInput>,
    ) -> Result<Option<crate::api::schema_waveform::WaveformOutput>, async_graphql::Error> {
        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;

        let _session = context
            .session_service
            .get(&session_id)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to get session: {:?}", e)))?
            .ok_or_else(|| async_graphql::Error::new("Session not found"))?;

        let capture_settings = settings.unwrap_or(CaptureSettingsInput {
            frequency: Some(440.0),
            amplitude: Some(0.5),
            noise_level: Some(0.02),
            duration_ms: Some(100),
        });

        let mut capture = MockAudioCapture::new()
            .with_sample_rate(44100)             .with_frequency(capture_settings.frequency.unwrap_or(440.0))
            .with_amplitude(capture_settings.amplitude.unwrap_or(0.5))
            .with_noise(capture_settings.noise_level.unwrap_or(0.02));

        let duration_ms = capture_settings.duration_ms.unwrap_or(100) as usize;
        let sample_rate = 44100u32;
        let num_samples = (sample_rate as usize * duration_ms) / 1000;
        let mut buffer = vec![0.0f32; num_samples];

        capture
            .start(None)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to start capture: {:?}", e)))?;

        let _ = capture.read_samples(&mut buffer).await;
        let _ = capture.stop().await;

        let waveform = crate::domain::Waveform::new(
            uuid::Uuid::new_v4().to_string(),
            session_id,
            buffer,
            Utc::now(),
        );

        let saved_waveform = context
            .waveform_service
            .save(waveform)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to save waveform: {:?}", e)))?;

        Ok(Some(crate::api::schema_waveform::WaveformOutput::from(saved_waveform)))
    }

    async fn update_session_dsp(
        &self,
        ctx: &Context<'_>,
        id: String,
        input: UpdateSessionDspInput,
    ) -> Result<Option<SessionOutput>, async_graphql::Error> {
        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;

        let session = context
            .session_service
            .update_session_dsp_metrics(
                &id,
                crate::application::service_scope::DspMetrics {
                    peak_amplitude: input.peak_amplitude,
                    rms_amplitude: input.rms_amplitude,
                    dc_offset: input.dc_offset,
                    dominant_frequency: input.dominant_frequency,
                    frequency_high: input.frequency_high,
                    frequency_low: input.frequency_low,
                },
            )
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to update session DSP: {:?}", e)))?;

        Ok(Some(SessionOutput::from(session)))
    }
}