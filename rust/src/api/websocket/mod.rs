//! WebSocket module for real-time streaming

pub mod client;
pub mod handler;

pub use client::{OutgoingMessage, WsClient, WsMessage};
pub use handler::{broadcast_all, broadcast_analysis, broadcast_spectrum, broadcast_waveform, create_ws_router, ClientConnection, WsConfig, WsState};
