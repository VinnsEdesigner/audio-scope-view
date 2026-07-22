# Audio Scope View - Complete System Architecture

> **Version:** 2.0  
> **Status:** Production Design  
> **Last Updated:** 2026-07-22

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [System Overview](#system-overview)
3. [Layer Architecture](#layer-architecture)
4. [C++ DSP Layer](#c-dsp-layer)
5. [Platform Bindings](#platform-bindings)
6. [Web Assembly Build](#web-assembly-build)
7. [UI Layer](#ui-layer)
8. [Server Layer](#server-layer)
9. [Communication Protocol](#communication-protocol)
10. [Audio Format Specification](#audio-format-specification)
11. [Phone Audio Limitations](#phone-audio-limitations)
12. [File Structure](#file-structure)
13. [Implementation Roadmap](#implementation-roadmap)

---

## Philosophy

### Core Principles

1. **Single DSP Core** - Write signal processing code once in C++, use everywhere
2. **Native Performance** - No interpreted languages in the DSP path
3. **Clean Separation** - Each layer has one job and does it well
4. **Server Simplicity** - Server is transport + storage, not a DSP engine

### Why C++ for DSP?

| Requirement | C++ Advantage |
|-------------|---------------|
| Real-time processing | Deterministic, no GC pauses |
| SIMD optimizations | Manual vectorization, intrinsics |
| Memory control | Zero-copy buffers, pool allocation |
| Cross-platform | Same code, different compilers |
| WASM compilation | Emscripten toolchain, proven |

### Why NOT TypeScript/Python for DSP?

- Garbage collection causes audio glitches
- No native SIMD support
- Higher latency in hot paths
- Mobile JS engines too slow for FFT

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE SYSTEM                                    │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │                        CLIENT APPLICATIONS                           │
    ├─────────────────────────────────────────────────────────────────────┤
    │                                                                      │
    │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
    │   │   Linux    │  │   Windows   │  │  Android    │  │    Web      │ │
    │   │    App     │  │    App      │  │    App      │  │  Browser    │ │
    │   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
    │          │                │                │                │         │
    │          └────────────────┼────────────────┼────────────────┘         │
    │                           ▼                                           │
    │   ┌─────────────────────────────────────────────────────────────────┐ │
    │   │                     C++ DSP LAYER (Native)                       │ │
    │   │  ┌─────────────────────────────────────────────────────────┐   │ │
    │   │  │                                                         │   │ │
    │   │  │  - Reverse AGC                                           │   │ │
    │   │  │  - Inverse Frequency Response                            │   │ │
    │   │  │  - Noise Gate Removal                                    │   │ │
    │   │  │  - DC Offset Correction                                   │   │ │
    │   │  │  - FFT / IFFT                                            │   │ │
    │   │  │  - Spectral Analysis                                      │   │ │
    │   │  │                                                         │   │ │
    │   │  └─────────────────────────────────────────────────────────┘   │ │
    │   └─────────────────────────────────────────────────────────────────┘ │
    │                                    │                                   │
    │                                    │ Standard Audio Format             │
    │                                    ▼                                   │
    │   ┌─────────────────────────────────────────────────────────────────┐ │
    │   │                      UI LAYER (TypeScript/React)                  │ │
    │   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │ │
    │   │  │   Canvas    │  │   WebGL     │  │   React Components      │ │ │
    │   │  │ Visualization│  │  Scopes     │  │   + State Management    │ │ │
    │   │  └─────────────┘  └─────────────┘  └─────────────────────────┘ │ │
    │   └─────────────────────────────────────────────────────────────────┘ │
    │                                    │                                   │
    └────────────────────────────────────┼───────────────────────────────────┘
                                         │ WebSocket
                                         │ { samples, measurements }
                                         ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                        SERVER (Rust)                                 │
    ├─────────────────────────────────────────────────────────────────────┤
    │                                                                       │
    │   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐    │
    │   │  WebSocket  │  │  Broadcast  │  │   Database Storage      │    │
    │   │   Receiver  │  │   Service   │  │   (Optional)            │    │
    │   └─────────────┘  └─────────────┘  └─────────────────────────┘    │
    │                                                                       │
    │                          NO DSP ON SERVER                             │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## Layer Architecture

### Layer 1: C++ DSP Core (sdk/dsp/)

**Responsibilities:**
- All signal processing algorithms
- FFT/IFFT computations
- Frequency domain corrections
- Time domain filters
- Audio analysis (THD, SNR, RMS, peak)

### Layer 2: Platform Bindings (sdk/bindings/)

**Responsibilities:**
- Bridge between native audio APIs and DSP layer
- Handle platform-specific audio capture
- Manage audio device enumeration
- Configure sample rates and buffer sizes

### Layer 3: WASM Build (sdk/wasm/)

**Responsibilities:**
- Compile C++ DSP to WebAssembly
- Bridge JavaScript audio APIs to WASM
- Handle browser audio context
- Memory management for WASM

### Layer 4: TypeScript UI Layer (apps/vyzorWeb/, apps/vyzorMobile/)

**Responsibilities:**
- React components for UI
- Canvas/WebGL waveform rendering
- WebSocket connection management
- Application state management (Zustand)
- User interactions

### Layer 5: Rust Server (rust/)

**Responsibilities:**
- WebSocket server
- Client connection management
- Message routing and broadcasting
- Database storage (optional)
- API authentication

---

## C++ DSP Layer

### Directory Structure

```
sdk/
├── dsp/
│   ├── CMakeLists.txt
│   ├── include/
│   │   └── audioscope/
│   │       ├── dsp.hpp
│   │       ├── fft.hpp
│   │       ├── filters.hpp
│   │       ├── measurements.hpp
│   │       └── corrections.hpp
│   └── src/
│       ├── dsp.cpp
│       ├── fft.cpp
│       ├── filters.cpp
│       ├── measurements.cpp
│       └── corrections.cpp
├── common/
│   ├── include/
│   │   └── audioscope/
│   │       ├── types.hpp
│   │       ├── buffer.hpp
│   │       └── config.hpp
│   └── src/
│       ├── buffer.cpp
│       └── config.cpp
└── tests/
    ├── test_fft.cpp
    ├── test_filters.cpp
    └── test_corrections.cpp
```

### Core DSP Components

#### 1. FFT Processor

```cpp
// sdk/dsp/include/audioscope/fft.hpp
namespace audioscope {
namespace dsp {

class FFTProcessor {
public:
    FFTProcessor(size_t fft_size);
    ~FFTProcessor();
    
    // Forward FFT
    void forward(const float* input, Complex* output);
    
    // Inverse FFT
    void inverse(const Complex* input, float* output);
    
    // Compute magnitude spectrum (dB)
    void magnitude_spectrum(const float* input, float* magnitudes);
    
    // Get frequency for bin index
    float bin_to_freq(size_t bin, float sample_rate);
    
private:
    size_t fft_size_;
    std::vector<Complex> fft_buffer_;
};

}} // namespace audioscope::dsp
```

#### 2. Corrections

```cpp
// sdk/dsp/include/audioscope/corrections.hpp
namespace audioscope {
namespace dsp {

struct CorrectionConfig {
    bool enable_agc_reversal = true;
    bool enable_filter_correction = false;
    bool enable_noise_gate_removal = true;
    bool enable_dc_offset_correction = true;
    
    float noise_gate_threshold_db = -60.0f;
    float agc_target_level = 0.5f;
    std::vector<float> inverse_response_curve;
};

class CorrectionsProcessor {
public:
    CorrectionsProcessor(const CorrectionConfig& config);
    
    // Apply all enabled corrections
    void process(float* samples, size_t count);
    
    // Individual corrections
    void remove_dc_offset(float* samples, size_t count);
    void reverse_agc(float* samples, size_t count, float detected_gain);
    void remove_noise_gate_artifacts(float* samples, size_t count);
    void apply_inverse_frequency_response(float* samples, size_t count);
    
private:
    CorrectionConfig config_;
    float dc_offset_ = 0.0f;
    float last_gain_ = 1.0f;
};

}} // namespace audioscope::dsp
```

#### 3. Measurements

```cpp
// sdk/dsp/include/audioscope/measurements.hpp
namespace audioscope {
namespace dsp {

struct Measurements {
    float peak_amplitude;        // 0.0 to 1.0
    float rms_amplitude;        // 0.0 to 1.0
    float dc_offset;            // -1.0 to 1.0
    float crest_factor;         // peak / rms
    float dominant_frequency;   // Hz
    float thd_percent;          // Total Harmonic Distortion %
    float snr_db;               // Signal to Noise Ratio dB
};

struct SpectrumData {
    std::vector<float> frequencies;    // Hz
    std::vector<float> magnitudes_db;   // dB
    float peak_frequency;               // Hz
    float peak_magnitude_db;             // dB
};

class MeasurementsProcessor {
public:
    MeasurementsProcessor(float sample_rate);
    
    // Analyze samples
    Measurements analyze(const float* samples, size_t count);
    
    // Get spectrum (requires FFT)
    SpectrumData get_spectrum(const float* samples, size_t count);
    
private:
    FFTProcessor fft_;
    float sample_rate_;
};

}} // namespace audioscope::dsp
```

#### 4. Main Processor

```cpp
// sdk/dsp/include/audioscope/dsp.hpp
namespace audioscope {
namespace dsp {

struct ProcessingResult {
    float* processed_samples;    // Corrected waveform
    size_t sample_count;
    Measurements measurements;
    SpectrumData spectrum;
    uint64_t timestamp_ms;
};

class AudioProcessor {
public:
    AudioProcessor(int sample_rate = 44100, size_t buffer_size = 4096);
    ~AudioProcessor();
    
    // Process a single audio frame
    ProcessingResult process_frame(const float* samples, size_t count);
    
    // Configuration
    void set_correction_config(const CorrectionConfig& config);
    void set_fft_size(size_t size);
    void set_sample_rate(int sample_rate);
    
    // Getters
    const Measurements& get_measurements() const;
    const SpectrumData& get_spectrum() const;
    
private:
    int sample_rate_;
    size_t buffer_size_;
    size_t fft_size_;
    
    FFTProcessor fft_;
    CorrectionsProcessor corrections_;
    MeasurementsProcessor measurements_;
    
    std::vector<float> output_buffer_;
    std::vector<Complex> fft_buffer_;
};

}} // namespace audioscope::dsp
```

### DSP Configuration

```cpp
// sdk/dsp/examples/example_basic.cpp
#include <audioscope/dsp.hpp>
#include <vector>

int main() {
    // Create processor for 44100 Hz, 4096 sample buffer
    audioscope::dsp::AudioProcessor processor(44100, 4096);
    
    // Configure corrections
    audioscope::dsp::CorrectionConfig config;
    config.enable_dc_offset_correction = true;
    config.enable_agc_reversal = true;
    config.enable_noise_gate_removal = true;
    config.noise_gate_threshold_db = -60.0f;
    
    processor.set_correction_config(config);
    
    // Process audio frame
    std::vector<float> samples = { /* audio data */ };
    auto result = processor.process_frame(samples.data(), samples.size());
    
    // Use result
    printf("Peak: %.3f, RMS: %.3f, Freq: %.1f Hz\n",
           result.measurements.peak_amplitude,
           result.measurements.rms_amplitude,
           result.measurements.dominant_frequency);
    
    return 0;
}
```

---

## Platform Bindings

### Linux (ALSA)

```cpp
// sdk/bindings/linux/alsa_binding.cpp
namespace audioscope {
namespace bindings {

class ALSABinding : public AudioBinding {
public:
    ALSABinding();
    ~ALSABinding() override;
    
    // AudioBinding interface
    std::vector<AudioDevice> enumerate_devices() override;
    bool start_capture(const std::string& device_id, int sample_rate) override;
    void stop_capture() override;
    bool read_samples(float* buffer, size_t count) override;
    
private:
    snd_pcm_t* capture_handle_;
    std::string current_device_;
};

}} // namespace audioscope::bindings
```

### Windows (WASAPI)

```cpp
// sdk/bindings/windows/wasapi_binding.cpp
namespace audioscope {
namespace bindings {

class WASAPIBinding : public AudioBinding {
public:
    WASAPIBinding();
    ~WASAPIBinding() override;
    
    // AudioBinding interface
    std::vector<AudioDevice> enumerate_devices() override;
    bool start_capture(const std::string& device_id, int sample_rate) override;
    void stop_capture() override;
    bool read_samples(float* buffer, size_t count) override;
    
private:
    IMFAttributes* attributes_;
    IMFMediaSession* session_;
    WAVEFORMATEX* wave_format_;
};

}} // namespace audioscope::bindings
```

### Android (JNI)

```cpp
// sdk/bindings/android/jni_bridge.cpp
extern "C" {

JNIEXPORT jlong JNICALL
Java_com_audioscope_NativeAudio_createProcessor(JNIEnv* env, jobject thiz) {
    return reinterpret_cast<jlong>(new audioscope::dsp::AudioProcessor(44100, 4096));
}

JNIEXPORT jfloatArray JNICALL
Java_com_audioscope_NativeAudio_processFrame(JNIEnv* env, jobject thiz,
                                              jlong processor_ptr,
                                              jfloatArray samples) {
    // Process audio and return result
}

JNIEXPORT void JNICALL
Java_com_audioscope_NativeAudio_destroyProcessor(JNIEnv* env, jobject thiz,
                                                  jlong processor_ptr) {
    delete reinterpret_cast<audioscope::dsp::AudioProcessor*>(processor_ptr);
}

} // extern "C"
```

**Kotlin Usage:**
```kotlin
// android/app/src/main/java/com/audioscope/NativeAudio.kt
class NativeAudio {
    private var processorPtr: Long = 0
    
    fun initialize() {
        processorPtr = createProcessor()
    }
    
    external fun processFrame(samples: FloatArray): FloatArray
    external fun getMeasurements(): Measurements
    
    companion object {
        init {
            System.loadLibrary("audioscope_dsp")
        }
        
        @JvmStatic
        external fun createProcessor(): Long
        @JvmStatic
        external fun destroyProcessor(ptr: Long)
    }
}
```

---

## Web Assembly Build

### Emscripten Configuration

```python
# sdk/wasm/build.py
import subprocess
import os

def build_wasm():
    emcc = os.environ.get('EMCC', 'emcc')
    
    # Compile C++ DSP to WASM
    cmd = [
        emcc,
        '../dsp/src/*.cpp',
        '-I../dsp/include',
        '-o', 'audioscope.js',
        '-s', 'EXPORTED_FUNCTIONS=["_process_frame", "_get_measurements", "_get_spectrum"]',
        '-s', 'EXPORTED_RUNTIME_METHODS=["ccall", "cwrap"]',
        '-s', 'ALLOW_MEMORY_GROWTH=1',
        '-s', 'MODULARIZE=1',
        '-s', 'EXPORT_ES6=1',
        '-O3',  # Optimization
        '--no-entry',
    ]
    
    subprocess.run(cmd, check=True)

if __name__ == '__main__':
    build_wasm()
```

### JavaScript WASM Bridge

```typescript
// src/audio/wasm-bridge.ts
import AudioScopeDSP from '@audioscope/dsp-wasm';

export interface Measurements {
  peakAmplitude: number;
  rmsAmplitude: number;
  dcOffset: number;
  crestFactor: number;
  dominantFrequency: number;
  thdPercent: number;
  snrDb: number;
}

export interface SpectrumData {
  frequencies: Float32Array;
  magnitudesDb: Float32Array;
  peakFrequency: number;
  peakMagnitudeDb: number;
}

export class WASMAudioBridge {
  private dsp: typeof AudioScopeDSP;
  private memory: WebAssembly.Memory;
  
  constructor() {
    this.memory = new WebAssembly.Memory({ initial: 256, maximum: 512 });
    this.dsp = AudioScopeDSP({
      wasmMemory: this.memory,
    });
  }
  
  async initialize(): Promise<void> {
    await this.dsp.ready;
    
    // Configure DSP
    this.dsp.setSampleRate(44100);
    this.dsp.setBufferSize(4096);
    this.dsp.setCorrectionConfig({
      enableDcOffsetCorrection: true,
      enableAgcReversal: true,
      enableNoiseGateRemoval: true,
      noiseGateThresholdDb: -60,
    });
  }
  
  processFrame(samples: Float32Array): Measurements {
    const result = this.dsp.processFrame(samples);
    return result.measurements;
  }
  
  getMeasurements(): Measurements {
    return this.dsp.getMeasurements();
  }
  
  getSpectrum(): SpectrumData {
    return this.dsp.getSpectrum();
  }
}
```

### Web Audio API Integration

```typescript
// src/audio/audio-capture.ts
import { WASMAudioBridge } from './wasm-bridge';

export class BrowserAudioCapture {
  private bridge: WASMAudioBridge;
  private audioContext: AudioContext;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  
  constructor() {
    this.audioContext = new AudioContext({ sampleRate: 44100 });
    this.bridge = new WASMAudioBridge();
  }
  
  async initialize(): Promise<void> {
    await this.bridge.initialize();
    
    // Request microphone access with processing DISABLED
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 44100,
      }
    });
    
    // Create audio pipeline
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      
      // Process through WASM DSP
      const measurements = this.bridge.processFrame(inputData);
      
      // Update UI with measurements
      this.onMeasurements(measurements);
    };
    
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }
  
  private onMeasurements(measurements: Measurements): void {
    // Emit to listeners
  }
  
  stop(): void {
    this.mediaStream?.getTracks().forEach(track => track.stop());
    this.processor?.disconnect();
    this.audioContext.close();
  }
}
```

---

## UI Layer

### React Components

```tsx
// src/components/scope/Oscilloscope.tsx
import { useEffect, useRef } from 'react';
import { useAudioConnection } from '../hooks/useAudioConnection';
import { useWaveformRenderer } from '../hooks/useWaveformRenderer';
import { WaveformCanvas } from './WaveformCanvas';
import { SpectrumDisplay } from './SpectrumDisplay';
import { TriggerControls } from './TriggerControls';

interface OscilloscopeProps {
  scopeId: string;
  serverUrl: string;
}

export function Oscilloscope({ scopeId, serverUrl }: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { measurements, spectrum, connectionState } = useAudioConnection(serverUrl, scopeId);
  const renderer = useWaveformRenderer(canvasRef);
  
  useEffect(() => {
    if (measurements && spectrum) {
      renderer.draw(measurements, spectrum);
    }
  }, [measurements, spectrum, renderer]);
  
  return (
    <div className="oscilloscope">
      <div className="scope-display">
        <WaveformCanvas ref={canvasRef} />
        <SpectrumDisplay data={spectrum} />
      </div>
      
      <div className="measurements">
        <MeasurementDisplay label="Peak" value={measurements?.peakAmplitude} />
        <MeasurementDisplay label="RMS" value={measurements?.rmsAmplitude} />
        <MeasurementDisplay label="Freq" value={measurements?.dominantFrequency} unit="Hz" />
        <MeasurementDisplay label="THD" value={measurements?.thdPercent} unit="%" />
      </div>
      
      <TriggerControls />
    </div>
  );
}
```

### WebSocket Hook

```typescript
// src/hooks/useAudioConnection.ts
import { useEffect, useState, useCallback } from 'react';

interface AudioMessage {
  type: 'audio_frame' | 'measurement' | 'spectrum' | 'error';
  measurements?: Measurements;
  spectrum?: SpectrumData;
  error?: string;
}

export function useAudioConnection(serverUrl: string, scopeId: string) {
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [spectrum, setSpectrum] = useState<SpectrumData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  const connect = useCallback(() => {
    setConnectionState('connecting');
    
    const ws = new WebSocket(`${serverUrl}/audio/${scopeId}`);
    
    ws.onopen = () => {
      setConnectionState('connected');
    };
    
    ws.onmessage = (event) => {
      const message: AudioMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'measurement':
          setMeasurements(message.measurements);
          break;
        case 'spectrum':
          setSpectrum(message.spectrum);
          break;
        case 'error':
          console.error('Audio error:', message.error);
          break;
      }
    };
    
    ws.onclose = () => {
      setConnectionState('disconnected');
    };
    
    wsRef.current = ws;
  }, [serverUrl, scopeId]);
  
  const disconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);
  
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);
  
  return {
    connectionState,
    measurements,
    spectrum,
    connect,
    disconnect,
  };
}
```

---

## Server Layer

### WebSocket Handler (Rust)

```rust
// rust/src/api/websocket/audio_handler.rs
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::IntoResponse,
};
use std::sync::Arc;

pub async fn audio_websocket_handler(
    ws: WebSocketUpgrade,
    Path(scope_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| audio_stream(socket, scope_id, state))
}

async fn audio_stream(
    socket: WebSocket,
    scope_id: String,
    state: Arc<AppState>,
) {
    let (sender, receiver) = socket.split();
    let (tx, mut rx) = tokio::sync::mpsc::channel::<AudioFrame>(1000);
    
    // Spawn tasks for bidirectional communication
    // (Production: add storage, broadcast, etc.)
}
```

### Message Types

```rust
// rust/src/api/websocket/messages.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    #[serde(rename = "audio_frame")]
    AudioFrame {
        samples: Vec<f32>,
        sample_rate: i32,
        timestamp_ms: i64,
        channels: i32,
    },
    #[serde(rename = "subscribe")]
    Subscribe { scope_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    #[serde(rename = "dsp_result")]
    DspResult {
        measurements: MeasurementsDto,
        spectrum: SpectrumDto,
    },
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeasurementsDto {
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
    pub dc_offset: f32,
    pub crest_factor: f32,
    pub dominant_frequency: f32,
    pub thd_percent: f32,
    pub snr_db: f32,
}
```

---

## Communication Protocol

### WebSocket Endpoint

```
ws://{server}:{port}/audio/{scope_id}
```

### Authentication

All WebSocket connections require the `Authorization` header (or query param):

```
ws://localhost:8080/audio/scope-123?token={BOOTSTRAP_KEY}
```

### Message Flow

```
┌──────────┐                                            ┌──────────┐
│  Client  │                                            │  Server  │
└────┬─────┘                                            └────┬─────┘
     │                                                       │
     │────────── Connection + Auth ──────────────────────▶   │
     │                                                       │
     │◀─────────── Welcome / Error ────────────────────────  │
     │                                                       │
     │◀══════════ Real-time Audio Stream ═══════════════════▶│
     │  (Client sends audio frames)                          │
     │                                                       │
     │◀─────────── DSP Results ─────────────────────────────  │
     │  (Measurements, Spectrum)                             │
     │                                                       │
     │◀══════════ Broadcast to Subscribers ════════════════▶│
     │  (Other clients viewing same scope)                   │
     │                                                       │
```

### Message Schema

**Client → Server (Audio Frame):**
```json
{
  "type": "audio_frame",
  "samples": [0.123, -0.456, 0.789, ...],
  "sample_rate": 44100,
  "timestamp_ms": 1234567890123,
  "channels": 1
}
```

**Server → Client (DSP Result):**
```json
{
  "type": "dsp_result",
  "waveform_id": "waveform-abc123",
  "measurements": {
    "peak_amplitude": 0.85,
    "rms_amplitude": 0.52,
    "dc_offset": 0.001,
    "crest_factor": 1.63,
    "dominant_frequency": 1000.0,
    "thd_percent": 0.45,
    "snr_db": 55.2
  },
  "spectrum": {
    "frequencies": [20.0, 21.0, 22.0, ...],
    "magnitudes_db": [-80.0, -75.0, -60.0, ...],
    "peak_frequency": 1000.0,
    "peak_magnitude_db": -10.5
  }
}
```

---

## Audio Format Specification

### Standard Format

All DSP processing operates on this canonical format:

```cpp
struct AudioFrame {
    float* samples;        // Normalized to [-1.0, 1.0]
    size_t sample_count;   // Number of samples
    int sample_rate;       // Hz (8000, 16000, 22050, 44100, 48000)
    int channels;          // 1 (mono) or 2 (stereo)
    uint64_t timestamp;   // Microseconds since epoch
};
```

### Sample Rate Support

| Sample Rate | Use Case | Buffer Time (4096 samples) |
|-------------|----------|---------------------------|
| 8000 Hz | Voice quality | 512 ms |
| 16000 Hz | Enhanced voice | 256 ms |
| 22050 Hz | Music (low) | 185 ms |
| 44100 Hz | CD quality | 92 ms |
| 48000 Hz | Professional | 85 ms |

### Buffer Size

- **Default:** 4096 samples
- **Minimum:** 256 samples (for low latency)
- **Maximum:** 16384 samples (for batch processing)

---

## Phone Audio Limitations

### What's Destroyed by Phone Processing

```
┌─────────────────────────────────────────────────────────────────┐
│  PHONE AUDIO PROCESSING PIPELINE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐    ┌───────┐    ┌────────┐    ┌──────────────┐   │
│  │Physical │    │  AGC  │    │  Low   │    │    Noise     │   │
│  │  Sound  │───▶│ (Gain │───▶│  Pass  │───▶│  Reduction   │   │
│  │         │    │ Change│    │ Filter │    │  (Clipping)  │   │
│  └─────────┘    └───────┘    └────────┘    └──────────────┘   │
│       │              │             │               │          │
│       │         Impossible         Cuts         Clips         │
│       │         to reverse      above 8kHz     quiet parts     │
│       ▼              ▼             ▼               ▼          │
│   ORIGINAL      GAIN INFO      FREQ INFO       AMPLITUDE      │
│   WAVEFORM      LOST          LOST            INFO LOST       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### What DSP Can (Partially) Fix

| Issue | Reversible? | Correction Method |
|-------|-------------|-------------------|
| DC offset | Yes | Simple mean subtraction |
| Static gain | Yes | Normalize to peak |
| Flat frequency response | Yes | Apply inverse curve |
| Gentle low-pass filter | Partial | IFFT with correction |
| Noise gate clipping | Partial | Interpolation |
| Dynamic AGC | No | Cannot recover original |
| Aggressive filtering | No | Irreversible |
| Compression artifacts | No | Cannot recover |

### Recommendation

**For accurate oscilloscope measurements:**

1. **Use hardware audio interface** (USB mic, audio jack)
2. **Disable all phone processing** (echo cancellation, noise suppression, AGC)
3. **Accept phone readings as approximations** only

**Setting for getUserMedia:**
```javascript
const constraints = {
  audio: {
    echoCancellation: false,    // DISABLE
    noiseSuppression: false,    // DISABLE
    autoGainControl: false,     // DISABLE
    sampleRate: 44100,
  }
};
```

---

## File Structure

```
audio-scope-view/
├── docs/
│   └── ARCHITECTURE.md                    # This document
│
├── sdk/                                   # C++ DSP SDK
│   ├── dsp/                              # Core DSP algorithms
│   │   ├── CMakeLists.txt
│   │   ├── include/
│   │   │   └── audioscope/
│   │   │       ├── dsp.hpp
│   │   │       ├── fft.hpp
│   │   │       ├── filters.hpp
│   │   │       ├── measurements.hpp
│   │   │       └── corrections.hpp
│   │   └── src/
│   │       ├── dsp.cpp
│   │       ├── fft.cpp
│   │       ├── filters.cpp
│   │       ├── measurements.cpp
│   │       └── corrections.cpp
│   │
│   ├── bindings/                         # Platform bindings
│   │   ├── linux/
│   │   │   ├── alsa_binding.cpp
│   │   │   └── CMakeLists.txt
│   │   ├── windows/
│   │   │   ├── wasapi_binding.cpp
│   │   │   └── CMakeLists.txt
│   │   └── android/
│   │       ├── jni_bridge.cpp
│   │       ├── AudioRecordWrapper.kt
│   │       └── CMakeLists.txt
│   │
│   ├── wasm/                             # WebAssembly build
│   │   ├── build.py
│   │   ├── audioscope.js                 # Emscripten output
│   │   └── audioscope.wasm               # Compiled WASM
│   │
│   └── tests/
│       ├── test_fft.cpp
│       ├── test_filters.cpp
│       └── test_corrections.cpp
│
├── apps/                                 # Client applications
│   ├── vyzorWeb/                         # Web application (React)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── scope/
│   │   │   │   │   ├── Oscilloscope.tsx
│   │   │   │   │   ├── WaveformCanvas.tsx
│   │   │   │   │   ├── SpectrumDisplay.tsx
│   │   │   │   │   └── TriggerControls.tsx
│   │   │   │   ├── layout/
│   │   │   │   ├── dashboard/
│   │   │   │   └── shared/
│   │   │   ├── hooks/                  # PRESENTATION LAYER
│   │   │   │   ├── useAudioConnection.ts
│   │   │   │   ├── useWaveformRenderer.ts
│   │   │   │   └── useWebSocket.ts
│   │   │   ├── store/                  # STATE LAYER (Zustand)
│   │   │   │   ├── scope-store.ts
│   │   │   │   ├── settings-store.ts
│   │   │   │   └── ui-store.ts
│   │   │   ├── lib/
│   │   │   └── routes/                 # UI LAYER (TanStack Router)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── ARCHITECTURE.md
│   │
│   └── vyzorMobile/                     # Mobile application (Expo)
│       ├── app/
│       │   ├── routes/                 # UI LAYER (Expo Router)
│       │   ├── components/
│       │   │   ├── scope/
│       │   │   └── dashboard/
│       │   ├── hooks/                  # PRESENTATION LAYER
│       │   └── store/                  # STATE LAYER (Zustand)
│       ├── android/
│       │   └── app/src/main/java/com/audioscope/
│       ├── ios/
│       ├── app.json
│       └── ARCHITECTURE.md
│
├── rust/                                 # Server
│   ├── src/
│   │   ├── api/
│   │   │   ├── websocket/
│   │   │   │   ├── handler.rs
│   │   │   │   ├── client.rs
│   │   │   │   └── messages.rs
│   │   │   └── auth/
│   │   ├── application/
│   │   │   ├── broadcast_service.rs
│   │   │   └── storage_service.rs
│   │   └── main.rs
│   ├── Cargo.toml
│   └── SPEC.md
│
└── package.json                          # Workspace root
```

---

## Implementation Roadmap

### Phase 1: C++ DSP Core (Week 1-2)
- [ ] Implement FFT processor
- [ ] Implement frequency domain filters
- [ ] Implement time domain filters
- [ ] Implement measurements (THD, SNR, RMS, peak)
- [ ] Implement corrections (DC offset, AGC reversal, noise gate)
- [ ] Write unit tests
- [ ] Benchmark performance

### Phase 2: Platform Bindings (Week 3-4)
- [ ] Linux: ALSA binding
- [ ] Windows: WASAPI binding
- [ ] Android: JNI bridge + Kotlin wrapper
- [ ] Test on each platform

### Phase 3: WASM Build (Week 5)
- [ ] Set up Emscripten build
- [ ] Compile C++ to WASM
- [ ] JavaScript bridge implementation
- [ ] Browser integration test

### Phase 4: TypeScript UI (Week 6-7)
- [ ] React component structure
- [ ] Canvas waveform renderer
- [ ] Spectrum display
- [ ] WebSocket connection hook
- [ ] Controls and settings

### Phase 5: Rust Server (Week 8)
- [ ] WebSocket handler
- [ ] Authentication middleware
- [ ] Broadcast service
- [ ] Optional database storage
- [ ] Load testing

### Phase 6: Integration (Week 9-10)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Bug fixes
- [ ] Documentation

---

## Appendix: Dependencies

### C++ SDK

| Library | Purpose | License |
|---------|---------|---------|
| KissFFT / FFTS | FFT computation | BSD / MIT |
| CMake | Build system | BSD |

### Rust Server

| Crate | Purpose | Version |
|-------|---------|---------|
| tokio | Async runtime | 1.x |
| axum | Web framework | 0.7.x |
| serde | Serialization | 1.x |
| tokio-tungstenite | WebSocket | 0.21.x |

### TypeScript / Web

| Package | Purpose | Version |
|---------|---------|---------|
| react | UI framework | 18.x |
| typescript | Language | 5.x |
| vite | Build tool | 5.x |
| @tanstack/react-query | Data fetching | 5.x |

---

## Implementation Status

### Server (Rust) - Complete ✅

| Module | Status | Description |
|--------|--------|-------------|
| `fft_processor.rs` | ✅ Wired | FFT computation with windowing |
| `measurements.rs` | ✅ Wired | THD, SNR, RMS, peak detection |
| `spectrogram.rs` | ✅ Wired | Waterfall/spectrogram display |
| `waveform_generators.rs` | ✅ Wired | Test signal generation |
| `compression/` | ✅ Wired | Data compression |
| `trigger/` | ✅ Wired | Trigger detection system |

### GraphQL DSP API - Available ✅

All DSP operations exposed via GraphQL mutations:
- `analyzeWaveform` - Full waveform measurements
- `fftAnalyze` - FFT spectrum analysis
- `computeSpectrogram` - Waterfall display data
- `analyzeHarmonics` - THD/N analysis
- `processAudio` - Full DSP pipeline

### Still Needed for Production

1. **Real-time WebSocket streaming** - Current API is request/response
2. **C++ DSP Layer** - For native apps with better performance
3. **WASM compilation** - For browser-based DSP
4. **Client implementations** - Platform-specific audio capture

---

*Document Version: 2.1*  
*Last Updated: 2026-07-22*
