
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub sample_rate: u32,
    pub buffer_size: u32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Scope {
    pub fn new(id: String, name: String) -> Self {
        let now = Utc::now();
        Self {
            id,
            name,
            description: None,
            sample_rate: 44100,
            buffer_size: 1024,
            is_active: false,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn rename(&mut self, name: String) {
        self.name = name;
        self.touch();
    }

    pub fn set_description(&mut self, description: Option<String>) {
        self.description = description;
        self.touch();
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate;
        self.touch();
    }

    pub fn set_buffer_size(&mut self, size: u32) {
        self.buffer_size = size;
        self.touch();
    }

    pub fn activate(&mut self) {
        self.is_active = true;
        self.touch();
    }

    pub fn deactivate(&mut self) {
        self.is_active = false;
        self.touch();
    }

    pub fn toggle_active(&mut self) {
        self.is_active = !self.is_active;
        self.touch();
    }

    fn touch(&mut self) {
        self.updated_at = Utc::now();
    }
}

#[derive(Debug, Clone)]
pub struct CreateScopeParams {
    pub name: String,
    pub description: Option<String>,
    pub sample_rate: Option<u32>,
    pub buffer_size: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct UpdateScopeParams {
    pub name: Option<String>,
    pub description: Option<String>,
    pub sample_rate: Option<u32>,
    pub buffer_size: Option<u32>,
}

#[derive(Debug, Clone, Default)]
pub struct ScopeStatistics {
    pub total_scopes: u32,
    pub active_scopes: u32,
    pub inactive_scopes: u32,
    pub average_sample_rate: u32,
    pub average_buffer_size: u32,
}