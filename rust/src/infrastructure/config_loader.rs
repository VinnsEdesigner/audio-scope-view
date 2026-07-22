//! Application configuration loader

#![allow(dead_code)]
use config::{Config, ConfigError, File};
use serde::Deserialize;

use crate::shared::error_app::{AppError, AppResult};

/// Application configuration
#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub graphql: GraphqlConfig,
    pub security: SecurityConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 8080,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            url: "sqlite:./data/audio_scope_view.db?mode=rwc".to_string(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct GraphqlConfig {
    pub playground_enabled: bool,
    pub introspection_enabled: bool,
}

impl Default for GraphqlConfig {
    fn default() -> Self {
        Self {
            playground_enabled: true,
            introspection_enabled: true,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct SecurityConfig {
    pub require_auth: bool,
    pub bootstrap_key: String,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            require_auth: true,
            bootstrap_key: "dev-bootstrap-key-change-in-production".to_string(),
        }
    }
}

impl AppConfig {
    /// Load configuration from file and environment
    pub fn load() -> AppResult<Self> {
        let config = Config::builder()
            .add_source(File::with_name("config").required(false))
            .add_source(File::with_name("config.local").required(false))
            .add_source(config::Environment::with_prefix("APP").separator("__"))
            .build()
            .map_err(|e: ConfigError| AppError::config(&e.to_string()))?;

        config
            .try_deserialize()
            .map_err(|e: ConfigError| AppError::config(&e.to_string()))
    }

    /// Load with explicit config path
    pub fn load_from(path: &str) -> AppResult<Self> {
        let config = Config::builder()
            .add_source(File::with_name(path).required(false))
            .add_source(config::Environment::with_prefix("APP").separator("__"))
            .build()
            .map_err(|e: ConfigError| AppError::config(&e.to_string()))?;

        config
            .try_deserialize()
            .map_err(|e: ConfigError| AppError::config(&e.to_string()))
    }

    /// Get server address
    pub fn server_address(&self) -> String {
        format!("{}:{}", self.server.host, self.server.port)
    }
}

#[allow(clippy::derivable_impls)]
impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig::default(),
            database: DatabaseConfig::default(),
            graphql: GraphqlConfig::default(),
            security: SecurityConfig::default(),
        }
    }
}
