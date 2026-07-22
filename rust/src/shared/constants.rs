//! Application constants

#![allow(dead_code)]

/// Default sample rate in Hz
pub const DEFAULT_SAMPLE_RATE: u32 = 44100;

/// Default buffer size in samples
pub const DEFAULT_BUFFER_SIZE: u32 = 1024;

/// Default time scale in ms/div
pub const DEFAULT_TIME_SCALE: f64 = 1.0;

/// Default voltage scale in V/div
pub const DEFAULT_VOLTAGE_SCALE: f64 = 1.0;

/// Maximum sample rate
pub const MAX_SAMPLE_RATE: u32 = 192000;

/// Maximum buffer size
pub const MAX_BUFFER_SIZE: u32 = 16384;

/// Minimum time scale in ms/div
pub const MIN_TIME_SCALE: f64 = 0.0001;

/// Maximum time scale in ms/div
pub const MAX_TIME_SCALE: f64 = 10000.0;

/// GraphQL endpoint path (relative - used with nesting)
pub const GRAPHQL_PATH: &str = "/";

/// GraphQL playground path (relative - used with nesting)
pub const GRAPHQL_PLAYGROUND_PATH: &str = "/playground";

/// Health check path (relative - used with nesting)
pub const HEALTH_PATH: &str = "/health";

/// WebSocket path (relative)
pub const WS_PATH: &str = "/ws";
