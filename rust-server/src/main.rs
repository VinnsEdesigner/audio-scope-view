//! ADC-scope REST + WebSocket server.
//!
//! - REST (axios-friendly JSON): /health, /config, /calibration, /measurements, /spectrum, /frame
//! - WebSocket (/stream): browser pushes Float32Array sample blocks (binary),
//!   server pushes back JSON frames (`{ frame, measurements }`) at ~30 Hz.

mod dsp;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::{Method, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tower_http::cors::{Any, CorsLayer};

use dsp::{Edge, Engine, Frame, Measurements};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Calibration {
    /// Volts per raw amplitude unit (multiplies Vpp / RMS / DC).
    gain_v_per_unit: f32,
    /// Time-base correction (~1.0). Multiplies reported frequency.
    time_factor: f32,
    /// Optional first-order IIR low-pass cutoff (Hz). None = off.
    lowpass_hz: Option<f32>,
    /// Boxcar smoothing window length (0 or 1 = off).
    smoothing: usize,
}

impl Default for Calibration {
    fn default() -> Self {
        Self { gain_v_per_unit: 1.0, time_factor: 1.0, lowpass_hz: None, smoothing: 0 }
    }
}

struct AppState {
    engine: Mutex<Engine>,
    cal: Mutex<Calibration>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .init();

    let state = Arc::new(AppState {
        engine: Mutex::new(Engine::new(65_536, 48_000.0)),
        cal: Mutex::new(Calibration::default()),
    });

    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any)
        .allow_origin(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/config", get(get_config))
        .route("/calibration", get(get_calibration).post(set_calibration))
        .route("/measurements", get(measurements))
        .route("/spectrum", get(spectrum))
        .route("/frame", get(frame))
        .route("/stream", get(ws_upgrade))
        .with_state(state)
        .layer(cors);

    let bind = std::env::var("SCOPE_BIND").unwrap_or_else(|_| "0.0.0.0:8787".into());
    let listener = tokio::net::TcpListener::bind(&bind).await.expect("bind");
    tracing::info!("scope-server listening on http://{bind}");
    axum::serve(listener, app).await.unwrap();
}

#[derive(Serialize)]
struct Health { status: &'static str, version: &'static str }

async fn health() -> Json<Health> {
    Json(Health { status: "ok", version: env!("CARGO_PKG_VERSION") })
}

async fn get_config(State(s): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let eng = s.engine.lock();
    let cal = s.cal.lock().clone();
    Json(serde_json::json!({
        "sample_rate": eng.sample_rate(),
        "calibration": cal,
    }))
}

async fn get_calibration(State(s): State<Arc<AppState>>) -> Json<Calibration> {
    Json(s.cal.lock().clone())
}

async fn set_calibration(
    State(s): State<Arc<AppState>>,
    Json(body): Json<Calibration>,
) -> Json<Calibration> {
    {
        let mut eng = s.engine.lock();
        eng.set_lowpass(body.lowpass_hz);
        eng.set_smoothing(body.smoothing);
    }
    *s.cal.lock() = body.clone();
    Json(body)
}

#[derive(Serialize)]
struct MeasurementResponse {
    #[serde(flatten)]
    m: Measurements,
    calibrated: CalibratedReadouts,
}

#[derive(Serialize)]
struct CalibratedReadouts {
    vpp_v: f32,
    rms_v: f32,
    dc_v: f32,
    frequency_hz: f32,
}

fn calibrated(m: &Measurements, cal: &Calibration) -> CalibratedReadouts {
    CalibratedReadouts {
        vpp_v: m.peak_to_peak * cal.gain_v_per_unit,
        rms_v: m.rms * cal.gain_v_per_unit,
        dc_v: m.dc_offset * cal.gain_v_per_unit,
        frequency_hz: m.frequency_ac.max(m.frequency) * cal.time_factor,
    }
}

async fn measurements(State(s): State<Arc<AppState>>) -> Json<MeasurementResponse> {
    let m = s.engine.lock().measure();
    let cal = s.cal.lock().clone();
    let calibrated = calibrated(&m, &cal);
    Json(MeasurementResponse { m, calibrated })
}

async fn spectrum(
    State(s): State<Arc<AppState>>,
    Query(q): Query<HashMap<String, String>>,
) -> Json<Vec<f32>> {
    let size: usize = q.get("size").and_then(|v| v.parse().ok()).unwrap_or(2048);
    Json(s.engine.lock().spectrum(size))
}

#[derive(Serialize)]
struct FrameResponse {
    #[serde(flatten)]
    frame: Frame,
    measurements: Measurements,
    calibrated: CalibratedReadouts,
}

async fn frame(
    State(s): State<Arc<AppState>>,
    Query(q): Query<HashMap<String, String>>,
) -> Json<FrameResponse> {
    let window: usize = q.get("window").and_then(|v| v.parse().ok()).unwrap_or(1024);
    let level: f32 = q.get("level").and_then(|v| v.parse().ok()).unwrap_or(0.0);
    let edge = match q.get("edge").map(|s| s.as_str()) {
        Some("falling") => Edge::Falling,
        Some("auto") => Edge::Auto,
        _ => Edge::Rising,
    };
    let (frame, m) = {
        let eng = s.engine.lock();
        (eng.frame(window, level, edge), eng.measure())
    };
    let cal = s.cal.lock().clone();
    let calibrated = calibrated(&m, &cal);
    Json(FrameResponse { frame, measurements: m, calibrated })
}

// ────────────────── WebSocket streaming ──────────────────

#[derive(Deserialize)]
struct StreamHello {
    sample_rate: f32,
    #[serde(default = "default_window")] window: usize,
    #[serde(default)] trigger_level: f32,
    #[serde(default = "default_edge")] edge: String,
}

fn default_window() -> usize { 1024 }
fn default_edge() -> String { "rising".into() }

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum StreamControl {
    Config {
        window: Option<usize>,
        trigger_level: Option<f32>,
        edge: Option<String>,
        sample_rate: Option<f32>,
    },
}

async fn ws_upgrade(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| ws_stream(socket, state))
}

async fn ws_stream(mut socket: WebSocket, state: Arc<AppState>) {
    let mut window = 1024usize;
    let mut trigger_level = 0.0f32;
    let mut edge = Edge::Rising;

    // Optional first message: JSON hello with sample-rate.
    if let Ok(Some(Ok(msg))) = tokio::time::timeout(Duration::from_millis(500), socket.recv()).await
    {
        if let Message::Text(t) = msg {
            if let Ok(hello) = serde_json::from_str::<StreamHello>(&t) {
                state.engine.lock().set_sample_rate(hello.sample_rate);
                window = hello.window;
                trigger_level = hello.trigger_level;
                edge = parse_edge(&hello.edge);
            }
        }
    }

    let mut tick = tokio::time::interval(Duration::from_millis(33));
    loop {
        tokio::select! {
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Binary(b))) => {
                        let samples = decode_f32_le(&b);
                        state.engine.lock().push(&samples);
                    }
                    Some(Ok(Message::Text(t))) => {
                        if let Ok(ctrl) = serde_json::from_str::<StreamControl>(&t) {
                            let StreamControl::Config { window: w, trigger_level: tl, edge: e, sample_rate: sr } = ctrl;
                            if let Some(w) = w { window = w.clamp(64, 4096); }
                            if let Some(tl) = tl { trigger_level = tl; }
                            if let Some(e) = e { edge = parse_edge(&e); }
                            if let Some(sr) = sr { state.engine.lock().set_sample_rate(sr); }
                        }
                    }
                    Some(Ok(Message::Ping(p))) => { let _ = socket.send(Message::Pong(p)).await; }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(_)) => break,
                    _ => {}
                }
            }
            _ = tick.tick() => {
                let (frame, m) = {
                    let eng = state.engine.lock();
                    (eng.frame(window, trigger_level, edge), eng.measure())
                };
                let cal = state.cal.lock().clone();
                let calibrated = calibrated(&m, &cal);
                let payload = serde_json::json!({
                    "type": "frame",
                    "frame": frame,
                    "measurements": m,
                    "calibrated": calibrated,
                });
                if socket.send(Message::Text(payload.to_string())).await.is_err() { break; }
            }
        }
    }
}

fn parse_edge(s: &str) -> Edge {
    match s {
        "falling" => Edge::Falling,
        "auto" => Edge::Auto,
        _ => Edge::Rising,
    }
}

fn decode_f32_le(bytes: &[u8]) -> Vec<f32> {
    let n = bytes.len() / 4;
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let b = &bytes[i * 4..i * 4 + 4];
        out.push(f32::from_le_bytes([b[0], b[1], b[2], b[3]]));
    }
    out
}

#[allow(dead_code)]
async fn not_found() -> impl IntoResponse { StatusCode::NOT_FOUND }