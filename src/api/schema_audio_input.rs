
use async_graphql::{Context, Object, InputObject};
use tracing::info;

use crate::api::context_extractor::GraphqlContext;

#[derive(InputObject)]
pub struct AudioInput {
    pub samples: Vec<f32>,
    pub sample_rate: i32,
    pub timestamp_ms: i64,
    pub channels: i32,
}

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

#[derive(Default)]
pub struct AudioInputQueryRoot;

#[Object]
impl AudioInputQueryRoot {
    async fn audio_info(&self) -> AudioInfo {
        AudioInfo {
            supported_sample_rates: vec![8000, 16000, 22050, 44100, 48000],
            max_samples_per_submit: 100000,
            supported_channels: vec![1, 2],
        }
    }
}

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

#[derive(Default)]
pub struct AudioInputMutationRoot;

#[Object]
impl AudioInputMutationRoot {
    async fn submit_audio(
        &self,
        ctx: &Context<'_>,
        session_id: String,
        input: AudioInput,
    ) -> AudioSubmitResult {
        info!("AUDIO: Received {} samples at {}Hz for session '{}'", 
              input.samples.len(), input.sample_rate, session_id);

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

        let _context = ctx.data_unchecked::<GraphqlContext>();
        
        
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
