use std::sync::Arc;

use tokio::sync::RwLock;

use crate::domain::{DomainResult, Waveform};
use crate::application::service_waveform::WaveformService;

#[derive(Debug, Clone)]
pub struct SimulationConfig {
    pub waveform_ids: Vec<String>,
    pub loop_enabled: bool,
    pub speed: f32,
    pub delay_between_ms: u64,
}

#[derive(Debug, Clone, Default)]
pub struct SimulationState {
    pub is_running: bool,
    pub is_paused: bool,
    pub current_index: usize,
    pub waveform_index: usize,
}

pub struct SimulationService {
    waveform_service: Arc<WaveformService>,
    state: Arc<RwLock<SimulationState>>,
    waveform_cache: Arc<RwLock<Vec<Waveform>>>,
}

impl SimulationService {
    pub fn new(waveform_service: Arc<WaveformService>) -> Self {
        Self {
            waveform_service,
            state: Arc::new(RwLock::new(SimulationState {
                is_running: false,
                is_paused: false,
                current_index: 0,
                waveform_index: 0,
            })),
            waveform_cache: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn load_waveforms(&self, waveform_ids: &[String]) -> DomainResult<()> {
        let mut cache = self.waveform_cache.write().await;
        cache.clear();

        for id in waveform_ids {
            if let Ok(Some(waveform)) = self.waveform_service.get(id).await {
                cache.push(waveform);
            }
        }

        Ok(())
    }

    pub async fn start_simulation(&self, config: SimulationConfig) -> DomainResult<bool> {
        let mut state = self.state.write().await;
        
        if state.is_running {
            return Ok(false);
        }

        self.load_waveforms(&config.waveform_ids).await?;

        state.is_running = true;
        state.is_paused = false;
        state.current_index = 0;
        state.waveform_index = 0;

        Ok(true)
    }

    pub async fn stop_simulation(&self) -> DomainResult<bool> {
        let mut state = self.state.write().await;
        let was_running = state.is_running;
        state.is_running = false;
        state.is_paused = false;
        Ok(was_running)
    }

    pub async fn pause_simulation(&self) -> DomainResult<bool> {
        let mut state = self.state.write().await;
        if state.is_running {
            state.is_paused = true;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub async fn resume_simulation(&self) -> DomainResult<bool> {
        let mut state = self.state.write().await;
        if state.is_running && state.is_paused {
            state.is_paused = false;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub async fn get_next_waveform(&self) -> DomainResult<Option<Waveform>> {
        let state = self.state.read().await;
        
        if !state.is_running || state.is_paused {
            return Ok(None);
        }

        let cache = self.waveform_cache.read().await;
        
        if cache.is_empty() {
            return Ok(None);
        }

        let waveform = cache.get(state.waveform_index).cloned();
        
        Ok(waveform)
    }

    pub async fn advance(&self, config: &SimulationConfig) -> DomainResult<bool> {
        let mut state = self.state.write().await;
        
        if !state.is_running {
            return Ok(false);
        }

        state.current_index += 1;
        state.waveform_index = if config.loop_enabled {
            (state.waveform_index + 1) % config.waveform_ids.len().max(1)
        } else if state.waveform_index + 1 >= config.waveform_ids.len() {
            return Ok(false);
        } else {
            state.waveform_index + 1
        };

        Ok(true)
    }

    pub async fn get_state(&self) -> SimulationState {
        let state = self.state.read().await;
        SimulationState {
            is_running: state.is_running,
            is_paused: state.is_paused,
            current_index: state.current_index,
            waveform_index: state.waveform_index,
        }
    }
}
