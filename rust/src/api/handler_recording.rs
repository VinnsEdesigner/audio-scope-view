use axum::{
    Json,
    body::Body,
    extract::{Extension, Path, Query, State},
    response::{IntoResponse, Response},
};
use bytes::Bytes;
use serde::Deserialize;
use std::sync::Arc;
use tracing::info;

use crate::api::server_graphql::{AccessDenied, AppState, AuthHeaderExt, DeviceIdExt};
use crate::application::export_service::{
    ExportFormat, RecordingExportData, StreamingExportService,
};

#[derive(Debug, Deserialize)]
pub struct SampleRangeParams {
    pub start: Option<usize>,
    pub end: Option<usize>,
}

#[derive(serde::Serialize)]
pub struct SampleChunkResponse {
    pub recording_id: String,
    pub start: usize,
    pub end: usize,
    pub total_samples: usize,
    pub samples: Vec<f32>,
}

/// Authenticate the REST request and verify the recording belongs to the caller's
/// device. Returns `Ok(())` on success, or an error response otherwise. The
/// `auth_header`/`device_id` extensions are injected by the `extract_auth_header`
/// middleware shared with the GraphQL router.
async fn authorize_recording(
    state: &AppState,
    auth_header: &Option<String>,
    device_id: &Option<String>,
    recording_id: &str,
) -> Result<(), Box<Response>> {
    let identity = match state
        .resolve_identity(auth_header.as_deref(), device_id.as_deref())
        .await
    {
        Some(id) => id,
        None => {
            return Err(Box::new(
                (
                    axum::http::StatusCode::UNAUTHORIZED,
                    Json(serde_json::json!({ "error": "Unauthorized" })),
                )
                    .into_response(),
            ));
        }
    };

    match state.check_recording_access(&identity, recording_id).await {
        Ok(()) => Ok(()),
        Err(AccessDenied) => Err(Box::new(
            (
                axum::http::StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Recording not found" })),
            )
                .into_response(),
        )),
    }
}

pub async fn get_recording_samples(
    State(state): State<Arc<AppState>>,
    Extension(AuthHeaderExt(auth_header)): Extension<AuthHeaderExt>,
    Extension(DeviceIdExt(device_id)): Extension<DeviceIdExt>,
    Path(recording_id): Path<String>,
    Query(params): Query<SampleRangeParams>,
) -> impl IntoResponse {
    info!("REQUEST: GET /api/recordings/{}/samples", recording_id);

    if let Err(resp) = authorize_recording(&state, &auth_header, &device_id, &recording_id).await {
        return *resp;
    }

    const DEFAULT_CHUNK_SIZE: usize = 100_000;
    const MAX_CHUNK_SIZE: usize = 500_000;
    let start = params.start.unwrap_or(0);
    let end = params.end.unwrap_or(DEFAULT_CHUNK_SIZE).min(MAX_CHUNK_SIZE);

    if start >= end {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Invalid range: start must be less than end"
            })),
        )
            .into_response();
    }

    let recording = match state.recording_service.get(&recording_id).await {
        Ok(Some(r)) => r,
        Ok(None) => {
            info!("RESPONSE: 404 Not Found");
            return (
                axum::http::StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": "Recording not found"
                })),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to get recording: {:?}", e);
            info!("RESPONSE: 500 Internal Server Error");
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to retrieve recording"
                })),
            )
                .into_response();
        }
    };

    let total_samples = recording.samples.len();

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
        )
            .into_response();
    }

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
    )
        .into_response()
}

pub async fn stream_recording_pcm(
    State(state): State<Arc<AppState>>,
    Extension(AuthHeaderExt(auth_header)): Extension<AuthHeaderExt>,
    Extension(DeviceIdExt(device_id)): Extension<DeviceIdExt>,
    Path(recording_id): Path<String>,
    Query(params): Query<SampleRangeParams>,
) -> Response {
    info!(
        "REQUEST: GET /api/recordings/{}/stream (PCM streaming)",
        recording_id
    );

    if let Err(resp) = authorize_recording(&state, &auth_header, &device_id, &recording_id).await {
        return *resp;
    }

    const DEFAULT_CHUNK_SIZE: usize = 44_100;
    const MAX_CHUNK_SIZE: usize = 176_400;
    let start = params.start.unwrap_or(0);
    let end = params.end.unwrap_or(DEFAULT_CHUNK_SIZE).min(MAX_CHUNK_SIZE);

    if start >= end {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Invalid range: start must be less than end"
            })),
        )
            .into_response();
    }

    let recording = match state.recording_service.get(&recording_id).await {
        Ok(Some(r)) => r,
        Ok(None) => {
            info!("RESPONSE: 404 Not Found");
            return (
                axum::http::StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": "Recording not found"
                })),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to get recording: {:?}", e);
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to retrieve recording"
                })),
            )
                .into_response();
        }
    };

    let total_samples = recording.samples.len();

    let clamped_start = start.min(total_samples);
    let clamped_end = end.min(total_samples);

    if clamped_start >= clamped_end {
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
        )
            .into_response();
    }

    let samples_slice = &recording.samples[clamped_start..clamped_end];
    let byte_count = samples_slice.len() * 4;
    let mut bytes = Vec::with_capacity(byte_count);
    for &sample in samples_slice {
        bytes.extend_from_slice(&sample.to_le_bytes());
    }

    info!("RESPONSE: 200 OK ({} bytes of PCM data)", byte_count);

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
            ("Accept-Ranges", "none"),
        ],
        Body::from(Bytes::from(bytes)),
    )
        .into_response()
}

#[derive(serde::Serialize)]
pub struct RecordingMetadataResponse {
    pub id: String,
    pub name: String,
    pub sample_count: usize,
    pub duration_ms: f64,
    pub sample_rate: u32,
}

pub async fn get_recording_metadata(
    State(state): State<Arc<AppState>>,
    Extension(AuthHeaderExt(auth_header)): Extension<AuthHeaderExt>,
    Extension(DeviceIdExt(device_id)): Extension<DeviceIdExt>,
    Path(recording_id): Path<String>,
) -> impl IntoResponse {
    info!("REQUEST: GET /api/recordings/{}/metadata", recording_id);

    if let Err(resp) = authorize_recording(&state, &auth_header, &device_id, &recording_id).await {
        return *resp;
    }

    let recording = match state.recording_service.get(&recording_id).await {
        Ok(Some(r)) => r,
        Ok(None) => {
            info!("RESPONSE: 404 Not Found");
            return (
                axum::http::StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": "Recording not found"
                })),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to get recording: {:?}", e);
            info!("RESPONSE: 500 Internal Server Error");
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to retrieve recording"
                })),
            )
                .into_response();
        }
    };

    let sample_rate = if recording.duration_ms > 0.0 {
        (recording.samples.len() as f64 / recording.duration_ms * 1000.0) as u32
    } else {
        44100
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
    )
        .into_response()
}

/// Helper function to extract recording data and create export service
fn prepare_recording_export(
    recording: &crate::domain::recording::Recording,
    sample_rate: u32,
) -> (RecordingExportData, StreamingExportService) {
    let export_data = RecordingExportData {
        id: recording.id.clone(),
        session_id: recording.session_id.clone(),
        name: recording.name.clone(),
        samples: recording.samples.clone(),
        timestamp: recording.timestamp.to_rfc3339(),
        duration_ms: recording.duration_ms,
        peak_amplitude: recording.peak_amplitude,
        rms_amplitude: recording.rms_amplitude,
    };
    let export_service = StreamingExportService::new(sample_rate);
    (export_data, export_service)
}

/// Helper to sanitize filename
fn sanitize_filename(name: &str) -> String {
    name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_")
}

/// Streaming CSV export handler
/// Streams CSV data in chunks to avoid memory issues with large recordings
pub async fn stream_recording_csv(
    State(state): State<Arc<AppState>>,
    Extension(AuthHeaderExt(auth_header)): Extension<AuthHeaderExt>,
    Extension(DeviceIdExt(device_id)): Extension<DeviceIdExt>,
    Path(recording_id): Path<String>,
) -> Response {
    info!(
        "REQUEST: GET /api/recordings/{}/csv (streaming CSV)",
        recording_id
    );

    if let Err(resp) = authorize_recording(&state, &auth_header, &device_id, &recording_id).await {
        return *resp;
    }

    // Get recording
    let recording = match state.recording_service.get(&recording_id).await {
        Ok(Some(r)) => r,
        Ok(None) => {
            info!("RESPONSE: 404 Not Found");
            return error_response(axum::http::StatusCode::NOT_FOUND, "Recording not found");
        }
        Err(e) => {
            tracing::error!("Failed to get recording: {:?}", e);
            return error_response(
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to retrieve recording",
            );
        }
    };

    let total_samples = recording.samples.len();
    let sample_rate = calculate_sample_rate(total_samples, recording.duration_ms);
    let (export_data, export_service) = prepare_recording_export(&recording, sample_rate);
    let filename = format!("{}.csv", sanitize_filename(&recording.name));

    info!(
        "RESPONSE: 200 OK - Streaming {} samples as CSV",
        total_samples
    );

    // Create streaming body using export service
    let samples = export_data.samples;
    let stream = tokio_stream::iter({
        // Header
        let mut chunks: Vec<Result<Bytes, _>> =
            vec![Ok(Bytes::from(StreamingExportService::csv_header()))];

        // Process samples in chunks
        for chunk in samples.chunks(10000) {
            let chunk_data = export_service.csv_chunk(chunk, 0, sample_rate);
            chunks.push(Ok(Bytes::from(chunk_data)));
        }

        chunks
    });

    success_stream_response(
        filename,
        ExportFormat::Csv.mime_type(),
        recording_id,
        total_samples,
        stream,
    )
}

/// Streaming WAV export handler
/// Exports audio data as WAV format
pub async fn stream_recording_wav(
    State(state): State<Arc<AppState>>,
    Extension(AuthHeaderExt(auth_header)): Extension<AuthHeaderExt>,
    Extension(DeviceIdExt(device_id)): Extension<DeviceIdExt>,
    Path(recording_id): Path<String>,
) -> Response {
    info!(
        "REQUEST: GET /api/recordings/{}/wav (streaming WAV)",
        recording_id
    );

    if let Err(resp) = authorize_recording(&state, &auth_header, &device_id, &recording_id).await {
        return *resp;
    }

    // Get recording
    let recording = match state.recording_service.get(&recording_id).await {
        Ok(Some(r)) => r,
        Ok(None) => {
            info!("RESPONSE: 404 Not Found");
            return error_response(axum::http::StatusCode::NOT_FOUND, "Recording not found");
        }
        Err(e) => {
            tracing::error!("Failed to get recording: {:?}", e);
            return error_response(
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to retrieve recording",
            );
        }
    };

    let total_samples = recording.samples.len();
    let sample_rate = calculate_sample_rate(total_samples, recording.duration_ms);
    let filename = format!("{}.wav", sanitize_filename(&recording.name));

    info!(
        "RESPONSE: 200 OK - Streaming {} samples as WAV",
        total_samples
    );

    // Generate WAV data using export service
    let export_service = StreamingExportService::new(sample_rate);
    let wav_data = match export_service.export_wav(&recording.samples) {
        Ok(data) => data,
        Err(e) => {
            tracing::error!("Failed to generate WAV: {:?}", e);
            return error_response(
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to generate WAV",
            );
        }
    };

    (
        axum::http::StatusCode::OK,
        [
            ("Content-Type", ExportFormat::Wav.mime_type()),
            (
                "Content-Disposition",
                &format!("attachment; filename=\"{}\"", filename),
            ),
            ("Content-Length", &wav_data.len().to_string()),
            ("X-Recording-Id", &recording_id),
            ("X-Total-Samples", &total_samples.to_string()),
            ("X-Sample-Rate", &sample_rate.to_string()),
        ],
        Body::from(wav_data),
    )
        .into_response()
}

/// Streaming JSON export handler
/// Exports recording metadata and samples as JSON
pub async fn stream_recording_json(
    State(state): State<Arc<AppState>>,
    Extension(AuthHeaderExt(auth_header)): Extension<AuthHeaderExt>,
    Extension(DeviceIdExt(device_id)): Extension<DeviceIdExt>,
    Path(recording_id): Path<String>,
) -> Response {
    info!(
        "REQUEST: GET /api/recordings/{}/json (streaming JSON)",
        recording_id
    );

    if let Err(resp) = authorize_recording(&state, &auth_header, &device_id, &recording_id).await {
        return *resp;
    }

    // Get recording
    let recording = match state.recording_service.get(&recording_id).await {
        Ok(Some(r)) => r,
        Ok(None) => {
            info!("RESPONSE: 404 Not Found");
            return error_response(axum::http::StatusCode::NOT_FOUND, "Recording not found");
        }
        Err(e) => {
            tracing::error!("Failed to get recording: {:?}", e);
            return error_response(
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to retrieve recording",
            );
        }
    };

    let total_samples = recording.samples.len();
    let sample_rate = calculate_sample_rate(total_samples, recording.duration_ms);
    let (export_data, export_service) = prepare_recording_export(&recording, sample_rate);
    let filename = format!("{}.json", sanitize_filename(&recording.name));

    info!(
        "RESPONSE: 200 OK - Streaming {} samples as JSON",
        total_samples
    );

    // Generate JSON data using export service
    let json_data = match export_service.export_json(&export_data) {
        Ok(data) => data,
        Err(e) => {
            tracing::error!("Failed to generate JSON: {:?}", e);
            return error_response(
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to generate JSON",
            );
        }
    };

    (
        axum::http::StatusCode::OK,
        [
            ("Content-Type", ExportFormat::Json.mime_type()),
            (
                "Content-Disposition",
                &format!("attachment; filename=\"{}\"", filename),
            ),
            ("Content-Length", &json_data.len().to_string()),
            ("X-Recording-Id", &recording_id),
            ("X-Total-Samples", &total_samples.to_string()),
            ("X-Sample-Rate", &sample_rate.to_string()),
        ],
        Body::from(json_data),
    )
        .into_response()
}

/// Calculate sample rate from duration and sample count
fn calculate_sample_rate(sample_count: usize, duration_ms: f64) -> u32 {
    if duration_ms > 0.0 {
        (sample_count as f64 / duration_ms * 1000.0) as u32
    } else {
        44100
    }
}

/// Helper to create error response
fn error_response(status: axum::http::StatusCode, message: &str) -> Response {
    (status, Json(serde_json::json!({ "error": message }))).into_response()
}

/// Helper to create successful streaming response
fn success_stream_response(
    filename: String,
    content_type: &str,
    recording_id: String,
    total_samples: usize,
    stream: impl tokio_stream::Stream<Item = Result<Bytes, std::convert::Infallible>> + Send + 'static,
) -> Response {
    (
        axum::http::StatusCode::OK,
        [
            ("Content-Type", content_type),
            (
                "Content-Disposition",
                &format!("attachment; filename=\"{}\"", filename),
            ),
            ("X-Recording-Id", &recording_id),
            ("X-Total-Samples", &total_samples.to_string()),
            ("Transfer-Encoding", "chunked"),
        ],
        Body::from_stream(stream),
    )
        .into_response()
}
