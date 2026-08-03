#![allow(dead_code)]

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TriggerDirection {
    Rising,
    Falling,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TriggerEdge {
    Rising,
    Falling,
    Both,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WindowCondition {
    Inside,
    Outside,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TriggerMode {
    Level {
        threshold: f32,
        direction: TriggerDirection,
    },
    Edge {
        threshold: f32,
        edge: TriggerEdge,
    },
    Window {
        low: f32,
        high: f32,
        condition: WindowCondition,
    },
    Auto,
    None,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TriggerEvent {
    Triggered { sample_index: usize, timestamp_ms: f64 },
    Timeout,
}

#[derive(Debug, Clone)]
pub struct TriggerConfig {
    pub mode: TriggerMode,
    pub timeout_ms: Option<u64>,
    pub pre_trigger_samples: usize,
    pub holdoff_samples: usize,
}

impl Default for TriggerConfig {
    fn default() -> Self {
        Self {
            mode: TriggerMode::Level { threshold: 0.0, direction: TriggerDirection::Rising },
            timeout_ms: Some(1000),
            pre_trigger_samples: 100,
            holdoff_samples: 50,
        }
    }
}

#[derive(Debug, Clone)]
pub struct TriggerState {
    last_value: f32,
    is_triggered: bool,
    holdoff_counter: usize,
    timeout_counter: u64,
    triggered_at: Option<usize>,
}

impl Default for TriggerState {
    fn default() -> Self {
        Self {
            last_value: 0.0,
            is_triggered: false,
            holdoff_counter: 0,
            timeout_counter: 0,
            triggered_at: None,
        }
    }
}

pub struct TriggerDetector {
    config: TriggerConfig,
    state: TriggerState,
}

impl TriggerDetector {
    pub fn new(config: TriggerConfig) -> Self {
        Self {
            config,
            state: TriggerState::default(),
        }
    }

    pub fn reset(&mut self) {
        self.state = TriggerState::default();
    }

    pub fn detect(&mut self, samples: &[f32], sample_rate: f32) -> Option<TriggerEvent> {
        if samples.is_empty() {
            return None;
        }

        let timeout_samples = self.config.timeout_ms
            .map(|ms| (ms as f32 / 1000.0 * sample_rate) as usize);

        for (i, &sample) in samples.iter().enumerate() {
            if self.state.holdoff_counter > 0 {
                self.state.holdoff_counter -= 1;
                self.state.last_value = sample;
                continue;
            }

            let triggered = match &self.config.mode {
                TriggerMode::Level { threshold, direction } => {
                    match direction {
                        TriggerDirection::Rising => {
                            self.state.last_value < *threshold && sample >= *threshold
                        }
                        TriggerDirection::Falling => {
                            self.state.last_value > *threshold && sample <= *threshold
                        }
                    }
                }
                TriggerMode::Edge { threshold, edge } => {
                    match edge {
                        TriggerEdge::Rising => {
                            self.state.last_value < *threshold && sample >= *threshold
                        }
                        TriggerEdge::Falling => {
                            self.state.last_value > *threshold && sample <= *threshold
                        }
                        TriggerEdge::Both => {
                            (self.state.last_value < *threshold && sample >= *threshold) ||
                            (self.state.last_value > *threshold && sample <= *threshold)
                        }
                    }
                }
                TriggerMode::Window { low, high, condition } => {
                    let inside = sample >= *low && sample <= *high;
                    match condition {
                        WindowCondition::Inside => inside,
                        WindowCondition::Outside => !inside,
                    }
                }
                TriggerMode::Auto => {
                    if let Some(timeout) = timeout_samples {
                        if self.state.timeout_counter >= timeout as u64 {
                            self.state.timeout_counter = 0;
                            return Some(TriggerEvent::Timeout);
                        }
                        self.state.timeout_counter += 1;
                    }
                    false
                }
                TriggerMode::None => false,
            };

            self.state.last_value = sample;

            if triggered {
                self.state.is_triggered = true;
                self.state.triggered_at = Some(i);
                self.state.holdoff_counter = self.config.holdoff_samples;
                
                let timestamp_ms = i as f64 / sample_rate as f64 * 1000.0;
                return Some(TriggerEvent::Triggered { sample_index: i, timestamp_ms });
            }
        }

        None
    }

    pub fn detect_with_pretrigger(&mut self, samples: &[f32], sample_rate: f32) -> Vec<f32> {
        if samples.len() <= self.config.pre_trigger_samples {
            return samples.to_vec();
        }

        let config = self.config.clone();
        let mut temp_detector = Self::new(config);

        for i in self.config.pre_trigger_samples..samples.len() {
            let window = &samples[i.saturating_sub(self.config.pre_trigger_samples)..=i];
            if temp_detector.detect(window, sample_rate).is_some() {
                let start = i.saturating_sub(self.config.pre_trigger_samples);
                return samples[start..].to_vec();
            }
        }

        samples[samples.len().saturating_sub(self.config.pre_trigger_samples)..].to_vec()
    }

    pub fn get_state(&self) -> &TriggerState {
        &self.state
    }

    pub fn set_mode(&mut self, mode: TriggerMode) {
        self.config.mode = mode;
        self.reset();
    }
}
