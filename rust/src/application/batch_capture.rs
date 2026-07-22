use std::sync::Arc;
use std::time::Duration;

use crate::domain::{DomainResult, Waveform};
use crate::application::service_waveform::WaveformService;

#[derive(Debug, Clone)]
pub struct BatchCaptureSettings {
    pub scope_id: String,
    pub count: u32,
    pub interval_ms: u64,
    pub sample_rate: u32,
    pub samples_per_capture: usize,
}

#[derive(Debug, Clone)]
pub struct BatchCaptureResult {
    pub waveforms: Vec<Waveform>,
    pub total_duration_ms: u64,
    pub success_count: u32,
    pub failure_count: u32,
}

pub struct BatchCaptureService {
    waveform_service: Arc<WaveformService>,
}

impl BatchCaptureService {
    pub fn new(waveform_service: Arc<WaveformService>) -> Self {
        Self { waveform_service }
    }

    pub async fn capture_batch(
        &self,
        settings: BatchCaptureSettings,
    ) -> DomainResult<BatchCaptureResult> {
        let start_time = std::time::Instant::now();
        let mut waveforms = Vec::with_capacity(settings.count as usize);
        let mut success_count = 0u32;
        let mut failure_count = 0u32;

        for i in 0..settings.count {
            tokio::time::sleep(Duration::from_millis(settings.interval_ms)).await;

            match self.capture_single(&settings, i).await {
                Ok(waveform) => {
                    success_count += 1;
                    waveforms.push(waveform);
                }
                Err(e) => {
                    failure_count += 1;
                    tracing::warn!("Batch capture {} failed: {:?}", i, e);
                }
            }
        }

        let total_duration_ms = start_time.elapsed().as_millis() as u64;

        Ok(BatchCaptureResult {
            waveforms,
            total_duration_ms,
            success_count,
            failure_count,
        })
    }

    async fn capture_single(
        &self,
        settings: &BatchCaptureSettings,
        index: u32,
    ) -> DomainResult<Waveform> {
        let samples = vec![0.0f32; settings.samples_per_capture];
        let id = format!("{}_{}", settings.scope_id, index);
        
        let waveform = Waveform::with_duration(
            id,
            settings.scope_id.clone(),
            samples,
            chrono::Utc::now(),
            settings.sample_rate as f64,
        );

        self.waveform_service.save(waveform.clone())
            .await
            .map_err(|e| crate::domain::DomainError::InvalidOperation { 
                message: format!("Failed to save waveform: {}", e) 
            })?;
        Ok(waveform)
    }
}
