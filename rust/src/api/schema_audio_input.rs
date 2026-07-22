//! Audio Input Schema - Platform-agnostic audio submission
//! 
//! Clients (Browser, Android, Desktop) capture audio using their platform-specific APIs
//! and send it to this mutation in a standardized format.
//!
//! The server does NOT need to know what platform the client is on.

use async_graphql::{Context, Object, InputObject};
use tracing::info;

use crate::api::context_extractor::GraphqlContext;

/// Input for submitting audio samples
#[derive(InputObject)]
pub struct AudioInput {
    /// Audio sample data as float32 array (normalized -1.0 to 1.0)
    pub samples: Vec<f32>,
    /// Sample rate in Hz (e.g., 44100, 48000)
    pub sample_rate: i32,
    /// Timestamp in milliseconds (unix epoch)
    pub timestamp_ms: i64,
    /// Number of channels (1 = mono, 2 = stereo)
    pub channels: i32,
}

/// Response for audio submission
pub struct AudioSubmitResult {
    pub success: bool,
    pub samples_received: usize,
}

#[Object]
impl AudioSubmitResult {
    async fn success(&self) -> bool {
        self.success
    }

    async fn samples_received(&self) -> usize {
        self.samples_received
    }
}

/// Query root for audio-related read operations
#[derive(Default)]
pub struct AudioInputQueryRoot;

#[Object]
impl AudioInputQueryRoot {
    /// Get supported audio formats/info
    async fn audio_info(&self) -> AudioInfo {
        AudioInfo {
            supported_sample_rates: vec![8000, 16000, 22050, 44100, 48000],
            max_samples_per_submit: 100000,
            supported_channels: vec![1, 2],
        }
    }
}

/// Audio format information
pub struct AudioInfo {
    pub supported_sample_rates: Vec<i32>,
    pub max_samples_per_submit: usize,
    pub supported_channels: Vec<i32>,
}

#[Object]
impl AudioInfo {
    async fn supported_sample_rates(&self) -> &[i32] {
        &self.supported_sample_rates
    }

    async fn max_samples_per_submit(&self) -> usize {
        self.max_samples_per_submit
    }

    async fn supported_channels(&self) -> &[i32] {
        &self.supported_channels
    }
}

/// Mutation root for audio input operations
#[derive(Default)]
pub struct AudioInputMutationRoot;

#[Object]
impl AudioInputMutationRoot {
    /// Submit audio samples from any client platform
    /// 
    /// The client is responsible for:
    /// - Detecting the platform (Browser/Android/Desktop)
    /// - Using the appropriate audio capture API
    /// - Converting to the standard format (f32 samples, normalized)
    /// 
    /// Server simply receives and processes the audio data.
    async fn submit_audio(
        &self,
        ctx: &Context<'_>,
        scope_id: String,
        input: AudioInput,
    ) -> AudioSubmitResult {
        info!("AUDIO: Received {} samples at {}Hz for scope '{}'", 
              input.samples.len(), input.sample_rate, scope_id);

        // Validate input
        if input.samples.is_empty() {
            return AudioSubmitResult {
                success: false,
                samples_received: 0,
            };
        }

        if input.sample_rate <= 0 {
            return AudioSubmitResult {
                success: false,
                samples_received: 0,
            };
        }

        // Get context services
        let _context = ctx.data_unchecked::<GraphqlContext>();
        
        // For now, just log the audio data
        // In a full implementation, this would:
        // 1. Find or create the scope
        // 2. Store/process the audio samples
        // 3. Broadcast to subscribers
        
        let num_samples = input.samples.len();
        let sample_rate = input.sample_rate;
        let duration_ms = (num_samples as f64 / sample_rate as f64 * 1000.0) as i64;
        
        info!("AUDIO: Processing {} samples ({}ms) at {}Hz", 
              num_samples, duration_ms, sample_rate);

        AudioSubmitResult {
            success: true,
            samples_received: num_samples,
        }
    }
}
