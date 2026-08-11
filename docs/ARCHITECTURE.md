# Audio Scope View - Architecture

> **Version:** 3.0
> **Status:** Target architecture (in implementation)
> **Last Updated:** 2026-08-10
>
> This document defines the *target* system architecture. The current codebase is a
> working demo (Rust server + TypeScript/React UI, Canvas2D rendering, DSP triplicated
> across Rust and TS) that validates the look and the transport/storage layer. This
> document is the destination the demo is migrating toward. For the concrete file-by-file
> migration plan, see `docs/ARCHITECTURE_IMPLEMENTATION_SPEC.md`.
>
> **Scope of this doc:** system topology, layer responsibilities, the C++ DSP core
> contract, platform binding strategy (Linux/Windows/Android), ESP32/Raspberry Pi USB
> integration via USB Audio Class, WASM bridge, WebGL rendering, the Rust server's reduced
> role, communication protocols, and per-section toolchain/dependencies.

---

## Philosophy

### Core Principles

1. **Single DSP Core** - One C++ implementation of every signal-processing algorithm,
   compiled to five targets (Linux, Windows, Android, WASM, Rust FFI). No second copy of
   FFT/measurements/corrections exists in Rust or TypeScript. The current Rust
   `fft_processor.rs` / `measurements.rs` / `spectrogram.rs` and the TS `scope-dsp.ts`
   are the migration source, not parallel implementations that stay.
2. **Native Performance** - No interpreted/GC language on the sample-to-pixel hot path.
   The hot path is: native capture → C++ DSP → WebGL vertex buffer. React handles controls
   and settings only; it never carries sample buffers in render state.
3. **Clean Separation** - Each layer has one job. The C++ core knows nothing about UI or
   transport. Bindings know nothing about DSP internals. The server is transport + storage.
4. **Server Simplicity** - The Rust server is transport + storage + auth only. It does not
   compute DSP. If the server ever needs analysis (e.g., over stored captures), it links the
   same C++ core via FFI rather than keeping a Rust DSP copy.
5. **Server-Optional Local Mode** - A native client (Linux/Windows/Android) can run fully
   offline: capture → C++ DSP → WebGL render, with local persistence (SQLite/IndexedDB),
   and sync to the server when a connection appears. The server is a coordination and
   multi-device store, not a hard dependency for a single-device field deployment.
6. **Plug-and-Play Hardware** - ESP32 and any UAC-compliant USB device enumerate as a
   standard audio input on every host OS. No per-platform driver code for supported USB
   hardware; the existing `AudioBinding` interface just sees another input device.

### Why C++ for DSP?

| Requirement | C++ Advantage |
|-------------|---------------|
| Real-time processing | Deterministic, no GC pauses |
| SIMD optimizations | Manual vectorization, intrinsics (`<immintrin.h>`, ARM NEON) |
| Memory control | Zero-copy buffers, pool allocation |
| Cross-platform | Same code, different compilers/NDK/Emscripten |
| WASM compilation | Emscripten toolchain, proven |
| Rust FFI | `extern "C"` ABI links cleanly into the Rust server via `cxx` |

### Why NOT TypeScript/Python for DSP?

- Garbage collection causes audio glitches on the hot path
- No native SIMD support (WebAssembly SIMD is available, but TS cannot emit it)
- Higher latency in hot paths
- Mobile JS engines too slow for real-time FFT at scope sample rates

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE SYSTEM                                 │
└─────────────────────────────────────────────────────────────────────────────┘

   ┌───────────────────────────────────────────────────────────────────────┐
   │  HOST DEVICES (run the client app)                                     │
   │  Linux · Windows · Android · Browser (WASM)                           │
   │                                                                        │
   │   ┌───────────────┐   USB / UAC   ┌──────────────────────────────┐    │
   │   │  ESP32-S3     │◄─────────────►│  Native Audio Binding         │    │
   │   │  + I2S codec  │  standard     │  (Oboe / WASAPI / ALSA /      │    │
   │   │  (UAC device) │  audio input  │   WebAudio + WASM)            │    │
   │   └───────────────┘               └──────────────┬───────────────┘    │
   │                                                    │ samples (f32)     │
   │                                                    ▼                   │
   │   ┌──────────────────────────────────────────────────────────────┐    │
   │   │  C++ DSP CORE  (sdk/dsp + sdk/common)                         │    │
   │   │  FFT/IFFT · measurements · spectrogram · corrections ·        │    │
   │   │  trigger · compression · waveform generators                  │    │
   │   └──────────────┬─────────────────────────────────┬──────────────┘    │
   │                  │ (native)                        │ (WASM)            │
   │                  ▼                                 ▼                   │
   │   ┌──────────────────────┐         ┌──────────────────────────────┐   │
   │   │ Native render bridge │         │ Emscripten JS bridge          │   │
   │   │ (JNI/JSI ↔ JS)       │         │ (WebAudio → WASM)             │   │
   │   └──────────┬───────────┘         └──────────┬───────────────────┘   │
   │              │                                 │                       │
   │              ▼                                 ▼                       │
   │   ┌─────────────────────────────────────────────────────────────────┐│
   │   │  UI LAYER (React) — apps/vyzorWeb (web), apps/vyzorMobile (RN)  ││
   │   │  WebGL2 scope renderer · controls/settings · Zustand store      ││
   │   └────────────────────────────┬────────────────────────────────────┘│
   │                                │                                     │
   │   ── local mode (offline) ──   │   ── online mode ──                  │
   │   local SQLite/IndexedDB       │   WebSocket + GraphQL               │
   └────────────────────────────────┼─────────────────────────────────────┘
                                    │
              ┌─────────────────────┴──────────────────────┐
              │  optional: server present                   │
              ▼                                             │
   ┌─────────────────────────────────────────────────────────────────────┐
   │  SERVER (Rust) — transport + storage + auth (NO DSP)                  │
   │  axum · async-graphql · WebSocket broadcast · SQLite/Turso ·         │
   │  device-id scoping · (optional) C++ core via FFI for stored analysis  │
   └─────────────────────────────────────────────────────────────────────┘
```

Two operational modes:

- **Local mode (server-optional):** capture → C++ DSP → WebGL render, with local
  persistence. Used for offline field work (ESP32 + Android, or a Linux laptop with no
  network). The server is not contacted.
- **Online mode (server present):** the same client additionally streams frames over the
  WebSocket to the Rust server for cross-device broadcast, persistence, and session
  management. The server stores and forwards; it does not compute DSP.

---

## Layer Architecture

### Layer 1 — C++ DSP Core (`sdk/dsp/`, `sdk/common/`)

**Responsibilities:**
- All signal-processing algorithms: FFT/IFFT, windowing, spectrum, spectrogram (STFT),
  measurements (RMS, peak, DC offset, crest factor, ZCR, dominant frequency, THD, SNR,
  harmonic analysis), corrections (DC offset, inverse frequency response, noise-gate
  interpolation, reverse-AGC estimation), trigger detection, compression (LZ4), and
  waveform generators (sine/square/saw/triangle/noise) used by the simulation service.
- Pure C++17, no UI, no I/O, no platform headers. Single static library
  `libaudioscope_dsp` + header-only `audioscope::common`.
- Compiled to five targets: Linux (GCC/Clang), Windows (MSVC), Android (NDK arm64-v8a /
  armeabi-v7a / x86_64), WASM (Emscripten), and a static lib linked into the Rust server
  via FFI.

**Toolchain / dependencies:**
- CMake ≥ 3.21 (preset-driven, `CMakePresets.json`)
- C++17; compilers: GCC 11+/Clang 13+ (Linux), MSVC 2022 (Windows), NDK r25+ (Android),
  Emscripten 3.1.40+ (WASM)
- FFT: FFTS or KissFFT (permissive license, single-header-friendly) — chosen over the
  Rust `rustfft` so the same C implementation serves all targets. SIMD paths hand-written
  for SSE2/AVX2 (x86) and NEON (ARM) under `#ifdef`.
- Compression: `lz4` (already a Rust dep; reuse the C library directly)
- Testing: GoogleTest
- (No external DSP framework — this is a custom core, not JUCE/portaudio.)

### Layer 2 — Platform Bindings (`sdk/bindings/`)

**Responsibilities:**
- Implement the `AudioBinding` interface (enumerate devices, start/stop capture,
  read_samples) for each host platform.
- Convert platform audio frames to normalized `float[]` at a configured sample rate and
  hand them to the DSP core. No DSP logic lives here.
- On Android, expose the DSP core to JS via JNI/JSI; on Web, expose via Emscripten + a
  WebAudio worklet.

**Toolchain / dependencies per platform:**
- **Linux:** ALSA (`libasound2` / `pkg-config`) for direct device access; PulseAudio
  (`libpulse-simple`) as a fallback for the `auto_null.monitor` source used in headless
  containers. cpal may stay as a Rust-side convenience, but the native client uses the
  ALSA binding directly.
- **Windows:** WASAPI (CoreAudio, `mmdevapi` + `avrt`), no third-party deps; MinGW/MSVC.
- **Android:** Google **Oboe** (AAudio/OpenSL ES wrapper) — the only supported audio
  abstraction. Built via NDK + CMake inside the React Native New Architecture (JSI). JNI
  bridge in `sdk/bindings/android/`; Kotlin/TS bridge in `apps/vyzorMobile/`.
- **Web:** Emscripten output + Web Audio API (`AudioWorkletNode`, 1 channel, processing
  disabled). No native deps.

### Layer 3 — WASM Build (`sdk/wasm/`)

**Responsibilities:**
- Compile `sdk/dsp` to a WebAssembly module with Emscripten.
- Export a flat C ABI (`process_frame`, `get_measurements`, `get_spectrum`,
  `compute_spectrogram`, `analyze_harmonics`, `find_trigger`) consumed by a thin TS
  wrapper.
- Ship as an ES module (`audioscope.js` + `audioscope.wasm`) consumed by the web app via
  the `@audio-scope-view/dsp-wasm` package (see file structure).

**Toolchain / dependencies:**
- Emscripten `emcc` (SDK); `-s WASM=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -O3 -msimd128`
  (WebAssembly SIMD enabled)
- Web Audio `AudioWorklet` (separate JS thread) feeds the WASM heap via `HEAPF32`
- No runtime JS deps; the bridge is hand-written TS in `packages/dsp-wasm/src/`.

### Layer 4 — TypeScript UI Layer (`apps/vyzorWeb/`, `apps/vyzorMobile/`)

**Responsibilities:**
- React components for UI; **WebGL2** scope/spectrum/spectrogram rendering (replaces the
  current Canvas2D `scope-canvas.tsx`).
- WebSocket + GraphQL connection management (unchanged from current demo).
- Application state (Zustand) — but sample buffers never flow through React state on the
  hot path; they go DSP → WebGL vertex buffer directly.
- User interactions / settings / dialogs (unchanged surface).

**Toolchain / dependencies:**
- Vite + React 19 (web); React Native 0.76+ New Architecture + JSI (mobile, ejecting
  from Expo managed to bare/prebuilt)
- WebGL2 (raw) or `regl` (thin WebGL2 wrapper) for the renderer — no full engine
- Apollo Client (web) + WS link (mobile); Zustand
- Existing shared `packages/api-client`, `packages/ui`, `packages/ui-radix`

### Layer 5 — Rust Server (`rust/`)

**Responsibilities (reduced):**
- GraphQL API (sessions, settings, recordings, waveforms, user prefs, api keys, about)
  — unchanged surface.
- WebSocket broadcast (legacy `/ws` + Apollo `/graphql/ws`) — unchanged protocol.
- Database storage (SQLite local + Turso cloud) + migrations — unchanged.
- Device-id scoping + auth — unchanged.
- **DSP removed.** `fft_processor.rs`, `measurements.rs`, `spectrogram.rs`,
  `waveform_generators.rs`, `trigger/detector.rs`, `compression/mod.rs` are deleted from
  Rust. The `schema_dsp.rs` resolvers (`fftAnalyze`, `analyzeWaveform`,
  `computeSpectrogram`, `analyzeHarmonics`, `processAudio`) call the C++ core via FFI
  (`cxx` bridge in `rust/src/infrastructure/dsp_ffi.rs`) so stored captures can be
  analyzed server-side with the *same* core, not a Rust reimplementation. The live
  `capture` mutation keeps using cpal for the server-hosted capture path but forwards
  samples to the FFI DSP for analysis.

**Toolchain / dependencies added:**
- `cxx = "1.2"` (C++/Rust FFI bridge); `cc` build dependency to compile the C++ core
  into the server build.
- Removed: `rustfft`, `num-complex` (no longer needed once DSP is in C++). `rand` stays
  only if Rust-side non-DSP randomness is needed; otherwise remove.

---

## C++ DSP Layer

### Directory Structure

```
sdk/
├── CMakeLists.txt                 # top-level: adds dsp, common, bindings(targets), tests
├── CMakePresets.json              # presets: linux, windows, android-arm64, wasm, ffi
├── cppcheck-suppressions.txt
│
├── common/
│   ├── CMakeLists.txt
│   ├── include/audioscope/common/
│   │   ├── types.hpp              # AudioDevice, SampleFormat, SampleBuffer, Span
│   │   ├── buffer.hpp            # ring buffer, pool allocator
│   │   └── config.hpp            # DspConfig (sample_rate, fft_size, window_type...)
│   └── src/
│       ├── buffer.cpp
│       └── config.cpp
│
├── dsp/
│   ├── CMakeLists.txt             # builds libaudioscope_dsp (static)
│   ├── include/audioscope/dsp/
│   │   ├── dsp.hpp                # AudioProcessor facade (owns fft/measurements/...)
│   │   ├── fft.hpp                # FftProcessor, WindowType, Spectrum
│   │   ├── measurements.hpp       # WaveformAnalysis, HarmonicAnalysis, measurement fns
│   │   ├── spectrogram.hpp        # SpectrogramProcessor, SpectrogramConfig/Data
│   │   ├── corrections.hpp        # DC offset, inverse FR, noise-gate interp, reverse-AGC
│   │   ├── trigger.hpp            # TriggerDetector (rising/falling/auto/single)
│   │   ├── compression.hpp        # LZ4 compress/decompress wrappers
│   │   └── generators.hpp         # sine/square/saw/triangle/noise synthesizers
│   └── src/
│       ├── dsp.cpp
│       ├── fft.cpp                # radix-2 + SIMD paths; migrated from fft_processor.rs
│       ├── measurements.cpp       # migrated from measurements.rs
│       ├── spectrogram.cpp        # migrated from spectrogram.rs
│       ├── corrections.cpp        # new (inverse FR, reverse-AGC) + DC from measurements
│       ├── trigger.cpp            # migrated from trigger/detector.rs
│       ├── compression.cpp        # migrated from compression/mod.rs (LZ4)
│       └── generators.cpp         # migrated from waveform_generators.rs
│
├── bindings/
│   ├── audio_binding.hpp          # abstract AudioBinding interface (in common/)
│   ├── linux/
│   │   ├── CMakeLists.txt
│   │   ├── alsa_binding.cpp       # ALSA capture
│   │   └── pulse_binding.cpp      # PulseAudio fallback (auto_null.monitor)
│   ├── windows/
│   │   ├── CMakeLists.txt
│   │   └── wasapi_binding.cpp
│   ├── android/
│   │   ├── CMakeLists.txt         # NDK build, linked into RN turbo module
│   │   ├── jni_bridge.cpp         # JNI exports for AudioProcessor + Oboe capture
│   │   └── oboe_capture.cpp       # Oboe AudioEngine
│   └── ffi/
│       ├── CMakeLists.txt
│       └── rust_cxx_bridge.h       # cxx-generated header consumed by Rust
│
├── wasm/
│   ├── CMakeLists.txt             # emcc toolchain
│   ├── emscripten_main.cpp        # exports flat C ABI
│   └── build.sh                   # convenience wrapper around emcmake cmake
│
└── tests/
    ├── CMakeLists.txt
    ├── test_fft.cpp
    ├── test_measurements.cpp
    ├── test_spectrogram.cpp
    ├── test_corrections.cpp
    ├── test_trigger.cpp
    └── test_generators.cpp
```

### Core DSP Components (contract)

The C++ API is the single source of truth. Each platform binding and the WASM bridge
wrap this exact API. Signatures are stable across all targets.

#### 1. FFT Processor — `audioscope::dsp::FftProcessor`

```cpp
enum class WindowType { Rectangular, Hann, Hamming, Blackman, FlatTop };

struct Spectrum {
    std::vector<float> frequencies;   // Hz, per bin
    std::vector<float> magnitudes_db;  // dBFS per bin
    float peak_frequency;
    float peak_magnitude_db;
    int   bins;
};

class FftProcessor {
public:
    explicit FftProcessor(int max_fft_size = 16384);
    Spectrum compute_magnitudes(const float* samples, size_t count,
                                float sample_rate, WindowType window);
    float    find_peak_frequency(const float* samples, size_t count, float sample_rate);
    void     set_window(WindowType w);
};
```

#### 2. Measurements — `audioscope::dsp::Measurements`

```cpp
struct WaveformAnalysis {
    float peak_amplitude, negative_peak_amplitude, rms, dc_offset;
    float crest_factor, zero_crossing_rate, dominant_frequency;
    float thd_percent, snr_db;
};
struct HarmonicAnalysis {
    FrequencyComponent fundamental;
    std::vector<FrequencyComponent> harmonics;
    float thd_percent, thdn_percent, signal_energy, noise_energy;
};
WaveformAnalysis analyze_waveform(const float* samples, size_t count, float sample_rate);
HarmonicAnalysis  analyze_harmonics (const float* samples, size_t count, float sample_rate);
// + amplitude_to_db, db_to_amplitude, peak_to_dbfs, rms_to_dbfs, crest_factor_db, snr_to_db
```

#### 3. Spectrogram — `audioscope::dsp::SpectrogramProcessor`

```cpp
struct SpectrogramConfig { int window_size; int overlap; float min_freq; float max_freq; };
struct SpectrogramData  { std::vector<float> magnitudes_db;  // row-major
                          std::vector<int64_t> time_bins; int time_slices, frequency_bins;
                          float sample_rate; int window_size, overlap; };
class SpectrogramProcessor {
public:
    SpectrogramData compute(const float* samples, size_t count, float sample_rate,
                            SpectrogramConfig config);
};
```

#### 4. Corrections — `audioscope::dsp::Corrections`

```cpp
void correct_dc_offset(float* samples, size_t count);
void normalize_peak(float* samples, size_t count, float target = 1.0f);
void apply_inverse_frequency_response(float* samples, size_t count,
                                       const std::vector<float>& inverse_curve,
                                       float sample_rate);
void interpolate_noise_gates(float* samples, size_t count, float threshold);
EstimateAgcResult estimate_agc(const float* samples, size_t count);  // best-effort, lossy
```

#### 5. Trigger — `audioscope::dsp::TriggerDetector`

```cpp
enum class TriggerEdge  { Rising, Falling, Auto };
enum class TriggerMode  { Auto, Normal, Single };
struct TriggerOptions   { TriggerEdge edge; TriggerMode mode; float level; int holdoff; };
struct TriggerResult     { int index; bool armed; };
TriggerDetector::TriggerResult find_trigger(const float* data, size_t count,
                                            TriggerOptions opts);
std::vector<float> triggered_window(const float* data, size_t count, size_t window_size,
                                    TriggerOptions opts);
```

#### 6. Main Processor (facade) — `audioscope::dsp::AudioProcessor`

```cpp
class AudioProcessor {
public:
    AudioProcessor(float sample_rate, int block_size);
    void  process_frame(const float* in, size_t count, float* out, size_t out_count);
    WaveformAnalysis measurements() const;
    Spectrum        spectrum() const;
    SpectrogramData spectrogram(SpectrogramConfig cfg) const;
    HarmonicAnalysis harmonics() const;
    TriggerResult   trigger(TriggerOptions opts) const;
};
```

#### 7. Compression & Generators

```cpp
std::vector<uint8_t> lz4_compress(const float* samples, size_t count);
std::vector<float>   lz4_decompress(const uint8_t* data, size_t size, size_t count);

class WaveformGenerator {
public:
    static WaveformGenerator sine(float freq, float amp);
    static WaveformGenerator square(float freq, float amp);
    static WaveformGenerator sawtooth(float freq, float amp);
    static WaveformGenerator triangle(float freq, float amp);
    static WaveformGenerator white_noise(float amp);
    std::vector<float> generate(double sample_rate, size_t num_samples) const;
};
```

### DSP Configuration

`audioscope::common::DspConfig` carries: `sample_rate` (default 44100), `block_size`
(1024), `fft_size` (4096), `window_type` (Hann), `overlap` (50%), `spectrogram_freq_range`.
Built from the same JSON shape the existing settings GraphQL input uses, so UI settings
map 1:1 to the C++ config with no translation layer.

---

## Platform Bindings

### Linux (ALSA)

```cpp
namespace audioscope::bindings {
class ALSABinding : public AudioBinding {
public:
    std::vector<AudioDevice> enumerate_devices() override;
    bool start_capture(const std::string& device_id, int sample_rate) override;
    void stop_capture() override;
    bool read_samples(float* buffer, size_t count) override;
private:
    snd_pcm_t* capture_handle_;
};
}
```
Deps: `libasound2-dev` (build), `libasound2` (runtime). Pulse fallback uses
`libpulse-simple` and reads `auto_null.monitor` for headless/CI environments.

### Windows (WASAPI)

```cpp
namespace audioscope::bindings {
class WASAPIBinding : public AudioBinding {
public:
    std::vector<AudioDevice> enumerate_devices() override;
    bool start_capture(const std::string& device_id, int sample_rate) override;
    void stop_capture() override;
    bool read_samples(float* buffer, size_t count) override;
private:
    IMMDeviceEnumerator* enumerator_;
    IAudioCaptureClient* capture_client_;
    WAVEFORMATEX* format_;
};
}
```
Deps: Windows SDK only (`mmdevapi`, `avrt`); no third-party. Built with MSVC 2022.

### Android (Oboe + JNI/JSI)

```cpp
// sdk/bindings/android/jni_bridge.cpp — extern "C" exports for the RN turbo module
extern "C" {
JNIEXPORT jlong JNICALL Java_com_audioscope_dsp_DspModule_nativeCreateProcessor(JNIEnv*, jobject, jfloat sample_rate, jint block_size);
JNIEXPORT jfloatArray JNICALL Java_com_audioscope_dsp_DspModule_nativeProcessFrame(JNIEnv*, jobject, jlong ptr, jfloatArray samples);
JNIEXPORT jobject   JNICALL Java_com_audioscope_dsp_DspModule_nativeMeasurements(JNIEnv*, jobject, jlong ptr);
JNIEXPORT void     JNICALL Java_com_audioscope_dsp_DspModule_nativeDestroyProcessor(JNIEnv*, jobject, jlong ptr);
}
```
**Kotlin/JSI bridge** (in `apps/vyzorMobile/android/.../DspModule.kt`) uses the React
Native New Architecture **JSI/TurboModule** (not the legacy bridge) so the float array is
passed by reference into the C++ heap with no serialization. Oboe
(`oboe::AudioStreamBuilder`) opens the input stream (AAudio on 8.1+, OpenSL ES fallback),
disables AGC/noise suppression on the Android audio effect chain for raw input. Deps:
Oboe (Google), NDK r25+, `CMakeLists.txt` integrated via `android/app/build.gradle`
`externalNativeBuild`.

> **Important:** Expo managed workflow does not support custom C++ TurboModules. The
> mobile app must move to **bare/prebuilt React Native** (`expo prebuild --platform
> android`, already scripted) and stay there. The New Architecture (Fabric/TurboModules)
> is required for the JSI bridge.

### ESP32 / Raspberry Pi over USB — USB Audio Class strategy

The ESP32 is the **transport**, not the analog front-end. The "just plug it in and
initialize" goal is achieved by making it a **USB Audio Class (UAC) 1.0 device**:

- **Firmware (`sdk/firmware/esp32/`):** ESP32-S3 (native USB) + an external I2S codec
  (e.g. UDA1334A / PCM1802 / WM8731 — the on-chip ADC is too low-rate/noisy for scope
  use). Firmware implements TinyUSB UAC descriptors so the device enumerates as a
  standard microphone/line-in on Linux, Windows, **and** Android (USB OTG). No host-side
  driver code is written; the platform `AudioBinding` sees it as a regular input device.
- **Why UAC over a custom libusb protocol:** UAC is plug-and-play on every OS. A custom
  bulk-USB protocol would need a per-platform host driver and loses the "just works"
  property. Only fall back to libusb if UAC latency/format constraints are hit (rare for
  scope-rate audio).
- **Raspberry Pi** is normally a **host**, not a peripheral — it runs the native Linux
  app directly. Pi Zero can be put in USB-gadget UAC mode if peripheral behavior is needed,
  but that's the exception.
- **Analog caveat:** the ESP32/MCU has no real analog conditioning. Accurate scope
  readings require an external input stage (protection, scaling, anti-alias) before the
  codec. The "phone audio limitations" table below applies doubly to a bare MCU ADC.

---

## WebAssembly Build

### Emscripten configuration (`sdk/wasm/CMakeLists.txt` + `build.sh`)

```bash
emcmake cmake -B build-wasm -DCMAKE_BUILD_TYPE=Release \
  -DWASM_SIMD=ON -DCMAKE_TOOLCHAIN_FILE=$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake
emmake cmake --build build-wasm
# outputs: build-wasm/audioscope.js + build-wasm/audioscope.wasm
```
Exported C ABI (flat, no name mangling): `process_frame`, `get_measurements`,
`get_spectrum`, `compute_spectrogram`, `analyze_harmonics`, `find_trigger`,
`lz4_compress`, `lz4_decompress`, `generate_waveform`. Flags:
`-s EXPORTED_RUNTIME_METHODS=["ccall","cwrap","HEAPF32","_malloc","_free"]`,
`-s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -O3 -msimd128`.

### JavaScript WASM bridge (`packages/dsp-wasm/src/`)

A thin TS wrapper (`AudioScopeDsp` class) loads the module, exposes typed methods that
allocate into `HEAPF32`, call the C ABI, and copy results out. This **replaces**
`apps/vyzorWeb/src/lib/scope-dsp.ts` entirely (no second FFT in TS).

### Web Audio API integration

An `AudioWorkletProcessor` (`packages/dsp-wasm/src/worklets/dsp-processor.js`) runs in a
real-time AudioWorklet thread, pulls samples from a lock-free ring fed by `getUserMedia`
(all processing disabled), and posts processed frames to the main thread for the WebGL
renderer. The worklet imports the WASM module once (worklet-scoped).

```javascript
const constraints = { audio: {
    echoCancellation: false, noiseSuppression: false, autoGainControl: false,
    channelCount: 1, sampleRate: 44100
}};
```

---

## UI Layer

### Rendering — WebGL2 (replaces Canvas2D)

The current `scope-canvas.tsx` uses `getContext("2d")` + `requestAnimationFrame`, which
chokes at high sample densities. The new renderer (`apps/vyzorWeb/src/lib/webgl/`) uses
WebGL2 with instanced line rendering: DSP output goes straight into a vertex buffer, a
single `gl.drawArrays` per frame. Spectrum as 1D texture + instanced quads; spectrogram
as a 2D texture updated each slice. `regl` (thin wrapper) is acceptable; no full engine.

### WebSocket (unchanged transport, see protocols)

### Messages (unchanged — see Communication Protocols)

---

## Communication Protocols

### WebSocket Endpoints (unchanged from current demo)

| Endpoint | Protocol | Purpose |
|---|---|---|
| `/ws` | legacy JSON binary-stream | waveform/spectrum/analysis frames (`Subscribe`, `SubscribeSpectrum`, `WaveformData`, `AnalysisData`) |
| `/graphql/ws` | Apollo `graphql-transport-ws` | `@apollo/client` subscriptions (`waveformSubscribe`, `spectrumSubscribe`, `statsSubscribe`, `analysisSubscribe`, `allWaveforms`) |

### Authentication (unchanged)

All connections require `Authorization: Bearer <bootstrap-or-api-key>` and `X-Device-Id`
(header or query param on WS, since browsers can't set WS handshake headers). Device
scoping enforces session ownership; unauthenticated requests are rejected at the
GraphQL/WS layer.

### Message shapes (current — kept)

- **Legacy `/ws`** (`rust/src/api/websocket/client.rs`):
  `WsMessage::{ Subscribe{session_id}, SubscribeSpectrum{session_id}, WaveformData{session_id,samples,sample_rate,channels,timestamp_ms}, AnalysisData{...} }`
  / `OutgoingMessage::{ Subscribed{session_id,stream_type}, WaveformUpdate{...}, SpectrumUpdate{...}, AnalysisUpdate{...} }`.
- **Apollo `/graphql/ws`**: `connection_init` → `connection_ack` → `subscribe`/`next`/`error`/`complete`.

### DSP result shape (now computed client-side, not server-side)

In local mode the DSP result never touches the wire. In online mode the client publishes
raw frames via `WaveformData`; the server broadcasts; the receiving client runs the same
C++ DSP locally. The server's `schema_dsp.rs` resolvers (over stored captures) call the
C++ core via FFI. The on-wire shape is unchanged, so existing clients keep working.

---

## Phone Audio Limitations

### What's destroyed by phone processing

```
┌─────────────────────────────────────────────────────────────────┐
│  PHONE AUDIO PROCESSING PIPELINE                                │
├─────────────────────────────────────────────────────────────────┤
│  Physical → AGC → Low-pass → Noise reduction → [delivered]      │
│   original   gain lost   >8kHz cut   quiet parts clipped         │
└─────────────────────────────────────────────────────────────────┘
```

### What DSP can (partially) fix

| Issue | Reversible? | Correction |
|-------|-------------|------------|
| DC offset | Yes | mean subtraction (`correct_dc_offset`) |
| Static gain | Yes | normalize to peak (`normalize_peak`) |
| Flat frequency response | Yes | apply inverse curve (`apply_inverse_frequency_response`) |
| Gentle low-pass filter | Partial | IFFT with correction |
| Noise gate clipping | Partial | interpolation (`interpolate_noise_gates`) |
| Dynamic AGC | No | cannot recover original |
| Aggressive filtering | No | irreversible |
| Compression artifacts | No | cannot recover |

### Recommendation

For accurate oscilloscope measurements: use a hardware audio interface (USB mic / ESP32
UAC device / jack), disable all phone processing, and accept phone-only readings as
approximations. The ESP32-with-codec path is the recommended field hardware.

---

## File Structure (target — see `ARCHITECTURE_IMPLEMENTATION_SPEC.md` for the full
file-by-file plan including new/modify/delete)

```
audio-scope-view/
├── sdk/                    # NEW — C++ DSP core, bindings, WASM, firmware
│   ├── common/  dsp/  bindings/  wasm/  tests/  firmware/esp32/
├── packages/
│   └── dsp-wasm/           # NEW — TS wrapper + worklet consuming the WASM core
├── apps/
│   ├── vyzorWeb/           # MODIFY — replace scope-dsp.ts + scope-canvas with WebGL + dsp-wasm
│   └── vyzorMobile/        # REBUILD — eject to bare RN, add JSI DSP turbo module
├── rust/                   # MODIFY — remove Rust DSP, add cxx FFI to C++ core
└── docs/
    ├── ARCHITECTURE.md                 # this document (target)
    └── ARCHITECTURE_IMPLEMENTATION_SPEC.md  # file-by-file migration plan
```

---

## Migration status (from demo → target)

1. **Transport/storage layer** — DONE & verified (GraphQL, WS, Turso, device scoping).
2. **C++ DSP core** — pending. Extract from `rust/src/domain/{fft_processor,measurements,spectrogram,waveform_generators,trigger/detector,compression}` and `apps/vyzorWeb/src/lib/scope-dsp.ts` into one C++ library; delete the Rust and TS copies.
3. **Platform bindings** — pending. ALSA/WASAPI/Oboe; cpal stays as server-side convenience only.
4. **WASM bridge + `packages/dsp-wasm`** — pending. Replaces `scope-dsp.ts`.
5. **WebGL renderer** — pending. Replaces `scope-canvas.tsx` Canvas2D path.
6. **Mobile eject + JSI** — pending. vyzorMobile is a config-only shell today.
7. **Server DSP removal + FFI** — pending. `schema_dsp.rs` resolvers → C++ via `cxx`.
8. **ESP32 firmware (UAC)** — pending. Separate build, not in the CI critical path.

---

*Document Version: 3.0*
*Last Updated: 2026-08-10*
