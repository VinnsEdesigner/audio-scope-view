//! Application configuration struct

#![allow(dead_code)]
#[derive(Debug, Clone)]
pub struct Config {
    pub server_host: String,
    pub server_port: u16,
    pub database_url: String,
    pub playground_enabled: bool,
    pub introspection_enabled: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server_host: "127.0.0.1".to_string(),
            server_port: 8080,
            database_url: "sqlite:./data/audio_scope_view.db".to_string(),
            playground_enabled: true,
            introspection_enabled: true,
        }
    }
}

impl Config {
    pub fn server_address(&self) -> String {
        format!("{}:{}", self.server_host, self.server_port)
    }
}
