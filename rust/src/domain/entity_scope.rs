#![allow(dead_code)]
//! Scope entity - Core domain entity for audio scope

use chrono::{DateTime, Utc};

/// Scope entity representing an audio oscilloscope instance
#[derive(Debug, Clone, PartialEq)]
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
    /// Create a new Scope with required fields
    pub fn new(id: String, name: String) -> Self {
        let now = Utc::now();
        Self {
            id,
            name,
            description: None,
            sample_rate: 44100,
            buffer_size: 1024,
            is_active: true,
            created_at: now,
            updated_at: now,
        }
    }

    /// Set the sample rate
    pub fn with_sample_rate(mut self, sample_rate: u32) -> Self {
        self.sample_rate = sample_rate;
        self
    }

    /// Set the buffer size
    pub fn with_buffer_size(mut self, buffer_size: u32) -> Self {
        self.buffer_size = buffer_size;
        self
    }

    /// Set the description
    pub fn with_description(mut self, description: Option<String>) -> Self {
        self.description = description;
        self
    }

    /// Calculate the duration of one buffer in milliseconds
    pub fn buffer_duration_ms(&self) -> f64 {
        (self.buffer_size as f64 / self.sample_rate as f64) * 1000.0
    }

    /// Deactivate the scope
    pub fn deactivate(&mut self) {
        self.is_active = false;
        self.updated_at = Utc::now();
    }

    /// Activate the scope
    pub fn activate(&mut self) {
        self.is_active = true;
        self.updated_at = Utc::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_scope() {
        let scope = Scope::new("scope-1".to_string(), "Test Scope".to_string());

        assert_eq!(scope.id, "scope-1");
        assert_eq!(scope.name, "Test Scope");
        assert!(scope.is_active);
        assert_eq!(scope.sample_rate, 44100);
        assert_eq!(scope.buffer_size, 1024);
    }

    #[test]
    fn test_buffer_duration() {
        let scope = Scope::new("scope-1".to_string(), "Test".to_string())
            .with_sample_rate(44100)
            .with_buffer_size(4410);

        // 4410 samples / 44100 Hz = 0.1 seconds = 100 ms
        assert!((scope.buffer_duration_ms() - 100.0).abs() < 0.01);
    }
}
