//! Session GraphQL schema - Ephemeral canvas tracking

use async_graphql::{Context, InputObject, Object, SimpleObject};
use chrono::Utc;

use crate::api::context_extractor::GraphqlContext;
use crate::domain::Session;
use crate::domain::trait_audio_capture::AudioCapture;
use crate::infrastructure::audio_capture_mock::MockAudioCapture;

/// Session status enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, async_graphql::Enum)]
pub enum SessionStatus {
    /// Session is actively capturing (oscilloscope open)
    Live,
    /// Session is paused (oscilloscope closed but session not ended)
    Paused,
    /// Session has ended
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

/// Session with status output (for UI display)
#[derive(Debug, SimpleObject)]
pub struct SessionWithStatusOutput {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub status: SessionStatus,
    pub recording_count: i64,
}

/// Paginated sessions with status output
#[derive(Debug, SimpleObject)]
pub struct SessionsWithStatusOutput {
    pub sessions: Vec<SessionWithStatusOutput>,
    pub total: i64,
    pub has_more: bool,
}

/// Session status counts
#[derive(Debug, SimpleObject)]
pub struct SessionStatusCountsOutput {
    pub live_count: i32,
    pub paused_count: i32,
    pub offline_count: i32,
    pub total: i32,
}

/// Session output type
#[derive(Debug, SimpleObject)]
pub struct SessionOutput {
    pub id: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_seconds: Option<i64>,
    /// Number of recordings created during this session
    pub recording_count: i64,
    /// Whether oscilloscope capture is currently active
    pub is_oscilloscope_open: bool,
    /// Total oscilloscope capture duration in milliseconds
    pub oscilloscope_duration_ms: Option<f64>,
}

impl SessionOutput {
    /// Create SessionOutput from Session without recording count
    fn from_session(session: Session) -> Self {
        let is_oscilloscope_open = session.is_oscilloscope_open();
        let oscilloscope_duration_ms = session.oscilloscope_duration_ms;
        Self {
            id: session.id,
            started_at: session.started_at.to_rfc3339(),
            ended_at: session.ended_at.map(|dt| dt.to_rfc3339()),
            duration_seconds: session.duration_seconds,
            recording_count: 0,
            is_oscilloscope_open,
            oscilloscope_duration_ms,
        }
    }

    /// Create SessionOutput from Session with recording count
    pub fn from_session_with_count(session: Session, recording_count: i64) -> Self {
        let is_oscilloscope_open = session.is_oscilloscope_open();
        let oscilloscope_duration_ms = session.oscilloscope_duration_ms;
        Self {
            id: session.id,
            started_at: session.started_at.to_rfc3339(),
            ended_at: session.ended_at.map(|dt| dt.to_rfc3339()),
            duration_seconds: session.duration_seconds,
            recording_count,
            is_oscilloscope_open,
            oscilloscope_duration_ms,
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

    /// Get all active (not ended) sessions
    async fn active_sessions(&self, ctx: &Context<'_>) -> Vec<SessionOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        
        let sessions = context
            .session_service
            .list(100, 0)
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

    /// Get paginated sessions with status information
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
        let total_limit = 1000u32; // For calculating has_more

        let sessions = context
            .session_service
            .list(total_limit, 0)
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
                created_at: session.started_at.to_rfc3339(),
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

    /// Get active sessions with status information
    async fn active_sessions_with_status(&self, ctx: &Context<'_>) -> Vec<SessionWithStatusOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        
        let sessions = context
            .session_service
            .list(100, 0)
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
                created_at: session.started_at.to_rfc3339(),
                status: SessionStatus::from(&session),
                recording_count: count as i64,
            });
        }
        
        results
    }

    /// Get session status counts
    async fn session_status_counts(&self, ctx: &Context<'_>) -> SessionStatusCountsOutput {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        
        let sessions = context
            .session_service
            .list(1000, 0)
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

/// Session mutation operations
#[derive(Default)]
pub struct SessionMutation;

#[Object]
impl SessionMutation {
    /// Create a new session (auto-called when canvas opens)
    async fn create_session(&self, ctx: &Context<'_>) -> Result<SessionOutput, async_graphql::Error> {
        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;
        
        let session = context
            .session_service
            .create_session()
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to create session: {:?}", e)))?;
            
        Ok(SessionOutput::from(session))
    }

    /// Get an active session or create a new one if none exists
    /// Use this when opening the oscilloscope to ensure there's always a session
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

    /// End a session
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

    /// Heartbeat to keep session alive
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

    /// Delete a session
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

    /// Open oscilloscope capture within a session
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

    /// Close oscilloscope capture within a session
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

    /// Capture audio and create a waveform
    /// Uses mock audio generation for testing
    async fn capture(
        &self,
        ctx: &Context<'_>,
        session_id: String,
        settings: Option<CaptureSettingsInput>,
    ) -> Result<Option<crate::api::schema_waveform::WaveformOutput>, async_graphql::Error> {
        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;

        // Verify session exists
        let _session = context
            .session_service
            .get(&session_id)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to get session: {:?}", e)))?
            .ok_or_else(|| async_graphql::Error::new("Session not found"))?;

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
        capture
            .start(None)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to start capture: {:?}", e)))?;

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
        let saved_waveform = context
            .waveform_service
            .save(waveform)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to save waveform: {:?}", e)))?;

        Ok(Some(crate::api::schema_waveform::WaveformOutput::from(saved_waveform)))
    }
}
