//! Recording REST API handlers
//! 
//! Provides endpoints for chunked sample loading to avoid loading entire recordings at once.
//! Includes both JSON and binary streaming endpoints.

use std::sync::Arc;
use axum::{
    extract::{Path, Query, State},
    response::{IntoResponse, Response},
    Json,
    body::Body,
};
use bytes::Bytes;
use serde::Deserialize;
use tracing::info;

use crate::api::server_graphql::AppState;

/// Query parameters for sample range requests
#[derive(Debug, Deserialize)]
pub struct SampleRangeParams {
    /// Start index (0-based)
    pub start: Option<usize>,
    /// End index (exclusive), defaults to 100000
    pub end: Option<usize>,
}

/// Response for sample range endpoint
#[derive(serde::Serialize)]
pub struct SampleChunkResponse {
    pub recording_id: String,
    pub start: usize,
    pub end: usize,
    pub total_samples: usize,
    pub samples: Vec<f32>,
}

/// Get a range of samples from a recording
/// 
/// GET /api/recordings/{id}/samples?start=0&end=100000
/// 
/// Returns JSON array of f32 samples for the specified range.
/// Default chunk size is 100,000 samples (~400KB).
pub async fn get_recording_samples(
    State(state): State<Arc<AppState>>,
    Path(recording_id): Path<String>,
    Query(params): Query<SampleRangeParams>,
) -> impl IntoResponse {
    info!("REQUEST: GET /api/recordings/{}/samples", recording_id);
    
    // Default chunk size: 100,000 samples (~400KB)
    const DEFAULT_CHUNK_SIZE: usize = 100_000;
    const MAX_CHUNK_SIZE: usize = 500_000; // ~2MB max
    
    let start = params.start.unwrap_or(0);
    let end = params.end.unwrap_or(DEFAULT_CHUNK_SIZE).min(MAX_CHUNK_SIZE);
    
    if start >= end {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Invalid range: start must be less than end"
            })),
        ).into_response();
    }
    
    // Fetch recording from database
    let recording = match state.recording_service.get(&recording_id).await {
        Ok(Some(r)) => r,
        Ok(None) => {
            info!("RESPONSE: 404 Not Found");
            return (
                axum::http::StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": "Recording not found"
                })),
            ).into_response();
        }
        Err(e) => {
            tracing::error!("Failed to get recording: {:?}", e);
            info!("RESPONSE: 500 Internal Server Error");
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to retrieve recording"
                })),
            ).into_response();
        }
    };
    
    let total_samples = recording.samples.len();
    
    // Clamp range to actual sample bounds
    let clamped_start = start.min(total_samples);
    let clamped_end = end.min(total_samples);
    
    if clamped_start >= clamped_end {
        info!("RESPONSE: 200 OK (empty range)");
        return (
            axum::http::StatusCode::OK,
            Json(SampleChunkResponse {
                recording_id: recording_id.clone(),
                start: clamped_start,
                end: clamped_end,
                total_samples,
                samples: vec![],
            }),
        ).into_response();
    }
    
    // Extract the requested range
    let samples: Vec<f32> = recording.samples[clamped_start..clamped_end].to_vec();
    
    info!("RESPONSE: 200 OK ({} samples)", samples.len());
    (
        axum::http::StatusCode::OK,
        Json(SampleChunkResponse {
            recording_id,
            start: clamped_start,
            end: clamped_end,
            total_samples,
            samples,
        }),
    ).into_response()
}

/// Streaming PCM endpoint for AudioWorklet
/// 
/// GET /api/recordings/{id}/stream
/// Query params:
///   - start: Start sample index (default: 0)
///   - end: End sample index (default: auto-calculated based on chunk size)
/// 
/// Returns raw binary f32 samples for efficient streaming playback.
/// The AudioWorklet processor will fetch chunks and play them seamlessly.
pub async fn stream_recording_pcm(
    State(state): State<Arc<AppState>>,
    Path(recording_id): Path<String>,
    Query(params): Query<SampleRangeParams>,
) -> Response {
    info!("REQUEST: GET /api/recordings/{}/stream (PCM streaming)", recording_id);
    
    const DEFAULT_CHUNK_SIZE: usize = 44_100; // ~1 second of audio at 44.1kHz (~176KB)
    const MAX_CHUNK_SIZE: usize = 176_400; // ~4 seconds max per request
    
    let start = params.start.unwrap_or(0);
    let end = params.end.unwrap_or(DEFAULT_CHUNK_SIZE).min(MAX_CHUNK_SIZE);
    
    if start >= end {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Invalid range: start must be less than end"
            })),
        ).into_response();
    }
    
    // Fetch recording from database
    let recording = match state.recording_service.get(&recording_id).await {
        Ok(Some(r)) => r,
        Ok(None) => {
            info!("RESPONSE: 404 Not Found");
            return (
                axum::http::StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": "Recording not found"
                })),
            ).into_response();
        }
        Err(e) => {
            tracing::error!("Failed to get recording: {:?}", e);
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to retrieve recording"
                })),
            ).into_response();
        }
    };
    
    let total_samples = recording.samples.len();
    
    // Clamp range to actual sample bounds
    let clamped_start = start.min(total_samples);
    let clamped_end = end.min(total_samples);
    
    if clamped_start >= clamped_end {
        // Return empty response with headers
        let body = Body::empty();
        return (
            axum::http::StatusCode::OK,
            [
                ("Content-Type", "application/octet-stream"),
                ("X-Recording-Id", &recording_id),
                ("X-Start-Sample", &clamped_start.to_string()),
                ("X-End-Sample", &clamped_end.to_string()),
                ("X-Total-Samples", &total_samples.to_string()),
                ("X-Chunk-Size", "0"),
            ],
            body,
        ).into_response();
    }
    
    // Extract samples as raw f32 bytes
    let samples_slice = &recording.samples[clamped_start..clamped_end];
    let byte_count = samples_slice.len() * 4; // 4 bytes per f32
    
    // Convert to bytes
    let mut bytes = Vec::with_capacity(byte_count);
    for &sample in samples_slice {
        bytes.extend_from_slice(&sample.to_le_bytes());
    }
    
    info!("RESPONSE: 200 OK ({} bytes of PCM data)", byte_count);
    
    // Return raw binary response
    (
        axum::http::StatusCode::OK,
        [
            ("Content-Type", "application/octet-stream"),
            ("Content-Length", &byte_count.to_string()),
            ("X-Recording-Id", &recording_id),
            ("X-Start-Sample", &clamped_start.to_string()),
            ("X-End-Sample", &clamped_end.to_string()),
            ("X-Total-Samples", &total_samples.to_string()),
            ("X-Chunk-Size", &samples_slice.len().to_string()),
            ("Accept-Ranges", "none"), // We handle chunking ourselves
        ],
        Body::from(Bytes::from(bytes)),
    ).into_response()
}

/// Get recording metadata (for checking total samples before chunked loading)
#[derive(serde::Serialize)]
pub struct RecordingMetadataResponse {
    pub id: String,
    pub name: String,
    pub sample_count: usize,
    pub duration_ms: f64,
    pub sample_rate: u32,
}

/// Get recording metadata without samples
/// 
/// GET /api/recordings/{id}/metadata
pub async fn get_recording_metadata(
    State(state): State<Arc<AppState>>,
    Path(recording_id): Path<String>,
) -> impl IntoResponse {
    info!("REQUEST: GET /api/recordings/{}/metadata", recording_id);
    
    let recording = match state.recording_service.get(&recording_id).await {
        Ok(Some(r)) => r,
        Ok(None) => {
            info!("RESPONSE: 404 Not Found");
            return (
                axum::http::StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": "Recording not found"
                })),
            ).into_response();
        }
        Err(e) => {
            tracing::error!("Failed to get recording: {:?}", e);
            info!("RESPONSE: 500 Internal Server Error");
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to retrieve recording"
                })),
            ).into_response();
        }
    };
    
    // Calculate sample rate from duration and sample count
    let sample_rate = if recording.duration_ms > 0.0 {
        (recording.samples.len() as f64 / recording.duration_ms * 1000.0) as u32
    } else {
        44100 // default
    };
    
    info!("RESPONSE: 200 OK");
    (
        axum::http::StatusCode::OK,
        Json(RecordingMetadataResponse {
            id: recording.id,
            name: recording.name,
            sample_count: recording.samples.len(),
            duration_ms: recording.duration_ms,
            sample_rate,
        }),
    ).into_response()
}
