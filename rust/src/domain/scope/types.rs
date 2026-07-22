//! Scope domain types

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Scope aggregate root
/// 
/// Represents an audio oscilloscope instance with its configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    /// Unique identifier
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Optional description
    pub description: Option<String>,
    /// Audio sample rate in Hz
    pub sample_rate: u32,
    /// Buffer size in samples
    pub buffer_size: u32,
    /// Whether this scope is currently active
    pub is_active: bool,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
}

impl Scope {
    /// Create a new scope
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

    /// Update the name
    pub fn rename(&mut self, name: String) {
        self.name = name;
        self.touch();
    }

    /// Update the description
    pub fn set_description(&mut self, description: Option<String>) {
        self.description = description;
        self.touch();
    }

    /// Update sample rate
    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate;
        self.touch();
    }

    /// Update buffer size
    pub fn set_buffer_size(&mut self, size: u32) {
        self.buffer_size = size;
        self.touch();
    }

    /// Activate the scope
    pub fn activate(&mut self) {
        self.is_active = true;
        self.touch();
    }

    /// Deactivate the scope
    pub fn deactivate(&mut self) {
        self.is_active = false;
        self.touch();
    }

    /// Toggle active state
    pub fn toggle_active(&mut self) {
        self.is_active = !self.is_active;
        self.touch();
    }

    /// Mark as updated
    fn touch(&mut self) {
        self.updated_at = Utc::now();
    }
}

/// Scope creation parameters
#[derive(Debug, Clone)]
pub struct CreateScopeParams {
    pub name: String,
    pub description: Option<String>,
    pub sample_rate: Option<u32>,
    pub buffer_size: Option<u32>,
}

/// Scope update parameters
#[derive(Debug, Clone)]
pub struct UpdateScopeParams {
    pub name: Option<String>,
    pub description: Option<String>,
    pub sample_rate: Option<u32>,
    pub buffer_size: Option<u32>,
}

/// Scope statistics
#[derive(Debug, Clone, Default)]
pub struct ScopeStatistics {
    pub total_scopes: u32,
    pub active_scopes: u32,
    pub inactive_scopes: u32,
    pub average_sample_rate: u32,
    pub average_buffer_size: u32,
}
