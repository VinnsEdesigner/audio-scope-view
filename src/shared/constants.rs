
#![allow(dead_code)]

pub const DEFAULT_SAMPLE_RATE: u32 = 44100;

pub const DEFAULT_BUFFER_SIZE: u32 = 1024;

pub const DEFAULT_TIME_SCALE: f64 = 1.0;

pub const DEFAULT_VOLTAGE_SCALE: f64 = 1.0;

pub const MAX_SAMPLE_RATE: u32 = 192000;

pub const MAX_BUFFER_SIZE: u32 = 16384;

pub const MIN_TIME_SCALE: f64 = 0.0001;

pub const MAX_TIME_SCALE: f64 = 10000.0;

pub const GRAPHQL_PATH: &str = "/";

pub const GRAPHQL_PLAYGROUND_PATH: &str = "/playground";

pub const HEALTH_PATH: &str = "/health";

pub const WS_PATH: &str = "/ws";