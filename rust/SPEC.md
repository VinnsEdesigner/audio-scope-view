# Audio Scope View Server - Implementation Specification

## Overview

Production-ready audio oscilloscope server with real-time waveform capture, analysis, and streaming capabilities.

---

## Priority Implementation Order

### Phase 1: Core Audio Features
1. [ ] Real Audio Capture (cpal crate - cross-platform)
2. [ ] FFT/Spectrum Analysis
3. [ ] Automated Measurements (THD, SNR, frequency detection)

### Phase 2: API/Frontend Features  
4. [ ] WebSocket Subscriptions (live streaming)
5. [ ] GraphQL Subscriptions

### Phase 3: Data/Storage Features
6. [ ] Waveform Export (WAV, CSV, JSON)
7. [ ] Batch Capture Mode
8. [ ] Data Compression (lz4)

### Phase 4: Security
9. [ ] API Key Authentication

### Phase 5: Testing/Development
10. [ ] Mock Data Generators (various waveforms)
11. [ ] Simulation/Replay Mode

### Phase 6: Advanced Features
12. [ ] Trigger System (level, edge, window)
13. [ ] Spectrogram/Waterfall

---

## Feature Specifications

### 1. Real Audio Capture

**Technology:** `cpal` crate (cross-platform: ALSA, PulseAudio, WASAPI, CoreAudio)

**Implementation:**
```
src/
  infrastructure/
    audio_capture_real.rs    # cpal-based capture (optional feature)
```

**Feature Flag:** `cargo build --features real-audio`

**API:**
```rust
trait AudioCapture {
    async fn start(&mut self, device_id: Option<&str>) -> DomainResult<()>;
    async fn stop(&mut self) -> DomainResult<()>;
    async fn read_samples(&mut self, buffer: &mut [f32]) -> DomainResult<u32>;
    async fn get_devices(&self) -> DomainResult<Vec<AudioDevice>>;
}
```

**Configuration:**
```yaml
audio:
  default_sample_rate: 44100
  default_channels: 1
  buffer_size: 1024
  device: "default"  # or specific device ID
```

---

### 2. FFT/Spectrum Analysis

**Technology:** `rustfft` or `rustdsp` crate

**Implementation:**
```
src/
  domain/
    fft_processor.rs         # FFT computation
    spectrum.rs              # Spectrum data types
```

**API:**
```rust
pub struct SpectrumData {
    pub frequencies: Vec<f32>,      // Hz
    pub magnitudes: Vec<f32>,       // dB
    pub peak_frequency: f32,       // Hz
    pub peak_magnitude: f32,        // dB
}

impl Waveform {
    pub fn compute_spectrum(&self, window: WindowType) -> SpectrumData;
}
```

**Window Types:** Hann, Hamming, Blackman, Rectangular

---

### 3. Automated Measurements

**Implementation:**
```
src/
  domain/
    measurements.rs          # THD, SNR, etc.
```

**API:**
```rust
pub struct WaveformAnalysis {
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
    pub dominant_frequency: f32,
    pub thd: f32,           // Total Harmonic Distortion (%)
    pub snr: f32,           // Signal-to-Noise Ratio (dB)
    pub crest_factor: f32,   // Peak/RMS ratio
    pub dc_offset: f32,
}
```

---

### 4. WebSocket Subscriptions

**Technology:** `tokio-tungstenite` + `axum`

**Implementation:**
```
src/
  api/
    websocket/
      mod.rs
      handler.rs
      client.rs
```

**Protocol:**
```json
// Client -> Server
{"type": "subscribe", "scope_id": "abc123", "stream": "waveform"}
{"type": "unsubscribe", "scope_id": "abc123", "stream": "waveform"}

// Server -> Client  
{"type": "waveform", "data": {"id": "...", "samples": [...], "timestamp": "..."}}
{"type": "spectrum", "data": {"frequencies": [...], "magnitudes": [...]}}
{"type": "error", "message": "..."}
```

**Endpoint:** `ws://host:port/ws`

---

### 5. GraphQL Subscriptions

**Technology:** `async-graphql` with WebSocket transport

**Schema:**
```graphql
type Subscription {
    waveformStream(scopeId: String!): WaveformOutput!
    spectrumStream(scopeId: String!): SpectrumOutput!
}
```

---

### 6. Waveform Export

**Formats:**
- **WAV:** PCM 16-bit, 44.1kHz
- **CSV:** timestamp,sample pairs
- **JSON:** Full WaveformOutput structure

**Implementation:**
```
src/
  application/
    export_service.rs
```

**API:**
```rust
#[derive(Enum)]
pub enum ExportFormat {
    WAV,
    CSV,
    JSON,
}

pub async fn export_waveform(
    &self, 
    waveform_id: &str, 
    format: ExportFormat
) -> AppResult<Vec<u8>>;
```

---

### 7. Batch Capture Mode

**Implementation:**
```
src/
  application/
    batch_capture.rs
```

**API:**
```graphql
input BatchCaptureSettings {
    scopeId: String!
    count: Int!           // Number of captures
    intervalMs: Int!       // Time between captures
    captureSettings: CaptureSettingsInput
}

type BatchCaptureResult {
    waveforms: [WaveformOutput!]!
    totalDurationMs: Int!
    successCount: Int!
    failureCount: Int!
}

mutation startBatchCapture($input: BatchCaptureSettings!): BatchCaptureResult!
```

---

### 8. Data Compression

**Technology:** `lz4` crate

**Implementation:**
- Compress samples before storage in SQLite
- Store compression metadata in waveform record
- Auto-detect and decompress on read

**Schema:**
```sql
ALTER TABLE waveforms ADD COLUMN compression TEXT DEFAULT 'none';
-- 'none', 'lz4', 'zstd'
```

---

### 9. API Key Authentication

**Implementation:**
```
src/
  api/
    auth/
      mod.rs
      api_key.rs
      middleware.rs
```

**Configuration:**
```yaml
security:
  require_auth: true
```

**Environment Variable:** `BOOTSTRAP_KEY` (required)

**Header:** `Authorization: Bearer <api_key>`

**Security Model:**
- `BOOTSTRAP_KEY` is hashed with SHA256 at startup
- Incoming keys are hashed and compared against stored hash
- Bootstrap key grants "system client" status
- System clients can create developer API keys via GraphQL mutation
- Developer keys are stored in database with individual hashes

**Middleware:**
```rust
async fn auth_middleware(req: Request, next: Next) -> Response {
    let key = req.headers().get("authorization")?;
    validate_api_key(key)?;  // Hash and compare
    next.run(req).await
}
```

**Request Logging:**
```
REQUEST: POST /graphql
AUTH: FAILED - invalid or missing API key
RESPONSE: 200 OK

REQUEST: POST /graphql
AUTH: OK - bootstrap_key
RESPONSE: 200 OK
```

---

### 9b. Audio Input & DSP Pipeline (Platform-Agnostic)

**Implementation:**
```
src/
  api/
    schema_audio_input.rs       # Audio submission (existing)
    schema_dsp.rs              # DSP schema (NEW - wired up)
  domain/
    fft_processor.rs            # FFT computation
    measurements.rs             # THD, SNR, etc.
    spectrogram.rs              # Waterfall display
```

**DSP Schema - Wired Up:**
```graphql
type Query {
    audioInfo: AudioInfo!
    dspCapabilities: DspCapabilities!
}

type Mutation {
    submitAudio(scopeId: String!, input: AudioInput!): AudioSubmitResult!
    fftAnalyze(input: FFTAnalysisInput!): FFTAnalysisResult!
    analyzeWaveform(input: WaveformMeasurementInput!): WaveformMeasurementResult!
    computeSpectrogram(input: SpectrogramInput!): SpectrogramResult!
    analyzeHarmonics(input: HarmonicAnalysisInput!): HarmonicAnalysisResult!
    processAudio(scopeId: String!, input: AudioInput!): FullDspResult!
}

type WaveformMeasurementResult {
    peakAmplitude: Float!        # 0.0 to 1.0
    rmsAmplitude: Float!        # 0.0 to 1.0
    dcOffset: Float!             # -1.0 to 1.0
    crestFactor: Float!         # peak / rms
    dominantFrequency: Float!   # Hz
    thdPercent: Float!          # Total Harmonic Distortion %
    snrDb: Float!              # Signal to Noise Ratio dB
}

type FFTAnalysisResult {
    frequencies: [Float!]!      # Hz
    magnitudesDb: [Float!]!      # dB
    peakFrequency: Float!        # Hz
    peakMagnitudeDb: Float!      # dB
    bins: Int!                  # FFT size
}

type SpectrogramResult {
    frequencies: [Float!]!      # Y-axis: frequency values
    timeBins: [Int!]!           # X-axis: timestamps
    magnitudesDb: [[Float!]!]!   # 2D array [time][freq]
    timeSlices: Int!            # Number of time columns
    frequencyBins: Int!         # Number of frequency rows
    sampleRate: Int!             # Hz
    windowSize: Int!             # FFT window size
    overlap: Int!               # Window overlap
}
```

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT (where phone/device corrections MUST happen)        │
├─────────────────────────────────────────────────────────────┤
│  Platform Audio API (getUserMedia / native)                │
│       ↓                                                    │
│  C++/Rust DSP (WASM for web) - PHONE CORRECTIONS           │
│       ↓                                                    │
│  - Reverse AGC (imperfect, best effort)                    │
│  - Inverse frequency response (device-specific lookup)     │
│  - Remove noise gate artifacts                             │
│       ↓                                                    │
│  WebSocket → Send to server (< 50ms latency target)         │
└─────────────────────────────────────────────────────────────┘
                         ↓ WebSocket
┌─────────────────────────────────────────────────────────────┐
│  SERVER (Rust) - DSP + Transport + Storage                │
├─────────────────────────────────────────────────────────────┤
│  WebSocket Receiver                                        │
│       ↓                                                    │
│  DspPipeline (Rust)                                        │
│       ├── FFT computation                                   │
│       ├── Measurements (THD, SNR, RMS, peak)              │
│       ├── Spectrogram generation                           │
│       └── DC offset / noise gate                           │
│       ↓                                                    │
│  Response: { spectrum, measurements, corrected_waveform }  │
│       ↓                                                    │
│  Broadcast to subscribers                                   │
│       ↓                                                    │
│  Archive to database (async)                              │
└─────────────────────────────────────────────────────────────┘
```

**⚠️ IMPORTANT: Phone Audio Limitations**

Phones apply destructive processing BEFORE your app receives data:
- Automatic Gain Control (AGC)
- Low-pass filtering (voice optimization)
- Noise reduction
- Echo cancellation
- Sample rate conversion

**These cannot be fully reversed server-side.** For accurate oscilloscope measurements:
1. Use hardware audio interface (USB mic, audio jack)
2. Or accept that phone waveforms are approximations

**WebSocket Protocol:**
```json
// Client → Server
{
  "type": "audio_frame",
  "scope_id": "scope-123",
  "samples": [0.1, -0.2, 0.5, ...],
  "sample_rate": 44100,
  "timestamp_ms": 1234567890,
  "channels": 1
}

// Server → Client  
{
  "type": "dsp_result",
  "waveform_id": "waveform-456",
  "spectrum": {
    "frequencies": [20, 30, 40, ...],
    "magnitudes_db": [-60, -50, -40, ...],
    "peak_frequency": 1000.0,
    "peak_magnitude_db": -10.0
  },
  "measurements": {
    "peak_amplitude": 0.8,
    "rms_amplitude": 0.5,
    "dominant_frequency": 1000.0,
    "thd_percent": 0.5,
    "snr_db": 60.0,
    "crest_factor": 1.6,
    "dc_offset": 0.001
  }
}
```

**Schema:**
```graphql
input AudioInput {
    samples: [Float!]!      # f32 normalized (-1.0 to 1.0)
    sampleRate: Int!        # Hz (e.g., 44100, 48000)
    timestampMs: Int!       # Unix timestamp in milliseconds
    channels: Int!          # 1 = mono, 2 = stereo
}

type AudioSubmitResult {
    success: Boolean!
    samplesReceived: Int!
}

type AudioInfo {
    supportedSampleRates: [Int!]!      # [8000, 16000, 22050, 44100, 48000]
    maxSamplesPerSubmit: Int!          # 100000
    supportedChannels: [Int!]!         # [1, 2]
}

type Query {
    audioInfo: AudioInfo!
}

type Mutation {
    submitAudio(scopeId: String!, input: AudioInput!): AudioSubmitResult!
}
```

**Request Logging:**
```
AUDIO: Received 4096 samples at 44100Hz for scope 'scope-123'
AUDIO: Processing 4096 samples (92ms) at 44100Hz
```

**Server Logs Request:**
```
REQUEST: POST /graphql
AUTH: OK - bootstrap_key
AUDIO: Received 4096 samples at 44100Hz for scope 'scope-123'
AUDIO: Processing 4096 samples (92ms) at 44100Hz
RESPONSE: 200 OK
```

---

### 10. Mock Data Generators

**Implementation:**
```
src/
  infrastructure/
    waveform_generators.rs
```

**Generators:**
```rust
pub enum WaveformGenerator {
    Sine { frequency: f64, amplitude: f32 },
    Square { frequency: f64, amplitude: f32, duty_cycle: f32 },
    Sawtooth { frequency: f64, amplitude: f32 },
    Triangle { frequency: f64, amplitude: f32 },
    Noise { noise_type: NoiseType },  // White, Pink, Brown
    Chirp { start_freq: f64, end_freq: f64 },
    AM { carrier: f64, modulator: f64, depth: f32 },
    FM { carrier: f64, deviation: f64, mod_freq: f64 },
    Impulse { frequency: f64 },
    MultiTone { frequencies: Vec<f64> },
}
```

---

### 11. Simulation/Replay Mode

**Implementation:**
```
src/
  application/
    simulation_service.rs
```

**API:**
```graphql
input SimulationConfig {
    waveformIds: [String!]!
    loop: Boolean!
    speed: Float!           # 1.0 = real-time
    delayBetweenMs: Int!
}

mutation startSimulation($config: SimulationConfig!): Boolean!
mutation stopSimulation: Boolean!
mutation pauseSimulation: Boolean!
mutation resumeSimulation: Boolean!
```

---

### 12. Trigger System

**Types:**
```rust
pub enum TriggerMode {
    Level { threshold: f32, direction: Direction },  // Rising/Falling
    Edge { threshold: f32, edge: Edge },            // Rising/Falling/Both
    Window { low: f32, high: f32, condition: WindowCondition },
    Auto,   // Auto trigger with timeout
    None,   // Free-run
}
```

**Implementation:**
```
src/
  domain/
    trigger/
      mod.rs
      detector.rs
```

---

### 13. Spectrogram/Waterfall

**Implementation:**
```
src/
  domain/
    spectrogram.rs
```

**API:**
```rust
pub struct SpectrogramData {
    pub frequencies: Vec<f32>,          // Y-axis (Hz)
    pub time_bins: Vec<i64>,            // X-axis (timestamps)
    pub magnitudes: Vec<Vec<f32>>,       // Z-axis (dB) [time][freq]
    pub sample_rate: u32,
    pub window_size: usize,
    pub overlap: usize,
}

mutation computeSpectrogram($waveformId: String!, $config: SpectrogramConfig!): SpectrogramData!
```

**Config:**
```graphql
input SpectrogramConfig {
    windowSize: Int! = 1024
    overlap: Int! = 512
    minFreq: Float = 0
    maxFreq: Float = 22050
}
```

---

## File Structure

```
audio-scope-view/rust/
в”њв”Ђв”Ђ src/
в”‚   в”њв”Ђв”Ђ api/
в”‚   в”‚   в”њв”Ђв”Ђ mod.rs
в”‚   в”‚   в”њв”Ђв”Ђ schema_root.rs
в”‚   в”‚   в”њв”Ђв”Ђ schema_scope.rs
в”‚   в”‚   в”њв”Ђв”Ђ schema_settings.rs
в”‚   в”‚   в”њв”Ђв”Ђ schema_waveform.rs
в”‚   в”‚   в”њв”Ђв”Ђ schema_dashboard.rs
в”‚   в”‚   в”њв”Ђв”Ђ context_extractor.rs
в”‚   в”‚   в”њв”Ђв”Ђ server_graphql.rs
в”‚   в”‚   в”њв”Ђв”Ђ websocket/
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ mod.rs
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ handler.rs
в”‚   в”‚   в”‚   в””в”Ђв”Ђ client.rs
в”‚   в”‚   в””в”Ђв”Ђ auth/
в”‚   в”‚       в”њв”Ђв”Ђ mod.rs
в”‚   в”‚       в”њв”Ђв”Ђ api_key.rs
в”‚   в”‚       в””в”Ђв”Ђ middleware.rs
в”‚   в”њв”Ђв”Ђ application/
в”‚   в”‚   в”њв”Ђв”Ђ mod.rs
в”‚   в”‚   в”њв”Ђв”Ђ service_scope.rs
в”‚   в”‚   в”њв”Ђв”Ђ service_settings.rs
в”‚   в”‚   в”њв”Ђв”Ђ service_waveform.rs
в”‚   в”‚   в”њв”Ђв”Ђ service_dashboard.rs
в”‚   в”‚   в”њв”Ђв”Ђ export_service.rs
в”‚   в”‚   в”њв”Ђв”Ђ batch_capture.rs
в”‚   в”‚   в””в”Ђв”Ђ simulation_service.rs
в”‚   в”њв”Ђв”Ђ domain/
в”‚   в”‚   в”њв”Ђв”Ђ mod.rs
в”‚   в”‚   в”њв”Ђв”Ђ entity_scope.rs
в”‚   в”‚   в”њв”Ђв”Ђ entity_settings.rs
в”‚   в”‚   в”њв”Ђв”Ђ entity_waveform.rs
в”‚   в”‚   в”њв”Ђв”Ђ trait_audio_capture.rs
в”‚   в”‚   в”њв”Ђв”Ђ trait_scope_repository.rs
в”‚   в”‚   в”њв”Ђв”Ђ trait_settings_repository.rs
в”‚   в”‚   в”њв”Ђв”Ђ trait_waveform_repository.rs
в”‚   в”‚   в”њв”Ђв”Ђ fft_processor.rs
в”‚   в”‚   в”њв”Ђв”Ђ spectrum.rs
в”‚   в”‚   в”њв”Ђв”Ђ measurements.rs
в”‚   в”‚   в”њв”Ђв”Ђ waveform_generators.rs
в”‚   в”‚   в”њв”Ђв”Ђ trigger/
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ mod.rs
в”‚   в”‚   в”‚   в””в”Ђв”Ђ detector.rs
в”‚   в”‚   в””в”Ђв”Ђ spectrogram.rs
в”‚   в”њв”Ђв”Ђ infrastructure/
в”‚   в”‚   в”њв”Ђв”Ђ mod.rs
в”‚   в”‚   в”њв”Ђв”Ђ audio_capture_mock.rs
в”‚   в”‚   в”њв”Ђв”Ђ audio_capture_real.rs      # NEW: cpal implementation
в”‚   в”‚   в”њв”Ђв”Ђ repo_sqlite_scope.rs
в”‚   в”‚   в”њв”Ђв”Ђ repo_sqlite_settings.rs
в”‚   в”‚   в”њв”Ђв”Ђ repo_sqlite_waveform.rs
в”‚   в”‚   в””в”Ђв”Ђ config_loader.rs
в”‚   в”њв”Ђв”Ђ shared/
в”‚   в”‚   в”њв”Ђв”Ђ mod.rs
в”‚   в”‚   в”њв”Ђв”Ђ result_type.rs
в”‚   в”‚   в”њв”Ђв”Ђ error_type.rs
в”‚   в”‚   в””в”Ђв”Ђ constants.rs
в”‚   в””в”Ђв”Ђ main.rs
в”њв”Ђв”Ђ Cargo.toml
в”њв”Ђв”Ђ Makefile
в”њв”Ђв”Ђ SPEC.md                    # This file
в””в”Ђв”Ђ README.md
```

---

## Configuration Schema

```yaml
# config.yaml
app:
  host: "0.0.0.0"
  port: 8080
  log_level: "info"

database:
  path: "./data/audio_scope_view.db"
  pool_size: 5

audio:
  default_sample_rate: 44100
  default_channels: 1
  buffer_size: 1024
  device: "default"

security:
  api_keys:
    - key: "${API_KEY}"
      name: "Default"
      scopes: ["read", "write", "capture"]
  require_auth: true

websocket:
  ping_interval_secs: 30
  ping_timeout_secs: 10
  max_clients: 100

export:
  max_waveform_size_mb: 50
  default_format: "json"
```

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BOOTSTRAP_KEY` | Primary API key (hashed at startup) | **Yes** |
| `DATABASE_PATH` | Path to SQLite DB | No |
| `RUST_LOG` | Log level (default: debug) | No |
| `SERVER_HOST` | Bind address | No |
| `SERVER_PORT` | Port | No |

---

## Testing Strategy

### Unit Tests
- FFT correctness (compare with known signals)
- Trigger detection accuracy
- Measurement calculations
- Waveform generators

### Integration Tests
- Audio capture with real device (if available)
- Database operations
- WebSocket connections
- Export functionality

### Mock Tests
- All waveform generators produce expected output
- Simulation mode replays correctly
- Batch capture handles errors gracefully

---

## Security Considerations

1. **API Key Storage:** Keys in environment variables, never in code
2. **Input Validation:** Sanitize all user inputs
3. **Rate Limiting:** Protect against abuse
4. **Compression:** Validate compressed data before decompression
5. **WebSocket:** Authenticate on connect, validate subscriptions

---

## Performance Targets

- Waveform capture latency: < 10ms
- FFT computation (4096 samples): < 5ms  
- WebSocket throughput: 60 fps @ 44100Hz / 512 samples
- Export WAV (1M samples): < 100ms
- Compression ratio: > 50% for audio data

---

## Implementation Checklist

- [x] Phase 1: Core Audio (FFT, Measurements)
- [x] Phase 2: Real Audio Capture (cpal)
- [x] Phase 3: WebSocket Subscriptions
- [x] Phase 4: GraphQL Subscriptions
- [x] Phase 5: Export Service
- [x] Phase 6: Batch Capture
- [x] Phase 7: Data Compression
- [x] Phase 8: API Key Auth (BOOTSTRAP_KEY, SHA256 hashing, request logging)
- [x] Phase 9: Mock Generators
- [x] Phase 10: Simulation Mode
- [x] Phase 11: Trigger System
- [x] Phase 12: Spectrogram
- [x] Phase 13: Platform-Agnostic Audio Input (submitAudio mutation)
- [x] Phase 14: DSP Schema Wired Up (FFT, measurements, spectrogram via GraphQL)

---

*Document generated: 2026-07-21*
