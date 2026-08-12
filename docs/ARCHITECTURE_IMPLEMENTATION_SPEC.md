# Audio Scope View — Architecture Implementation Spec

> **Version:** 1.0
> **Last Updated:** 2026-08-10
> **Companion doc:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) (target architecture)
>
> This is the file-by-file migration plan from the current demo (Rust server + TS/React
> UI, Canvas2D rendering, DSP triplicated across Rust and TS) to the target architecture
> (single C++ DSP core, native bindings, WASM, WebGL2, reduced Rust server). It lists
> every file to **create**, **modify**, or **delete**, with exact paths, so implementation
> is deterministic rather than exploratory.
>
> **Reading order:** §1 current state summary → §2 target tree → §3 per-section plans
> (new / modify / delete) → §4 sequencing → §5 toolchain install → §6 hazards.

---

## 1. Current state (verified against the repo)

| Area | What exists | Path |
|---|---|---|
| DSP — Rust | FFT, measurements, spectrogram, generators, trigger, compression | `rust/src/domain/{fft_processor,measurements,spectrogram,waveform_generators}.rs`, `rust/src/domain/trigger/{mod,detector}.rs`, `rust/src/domain/compression/mod.rs` |
| DSP — TS (duplicate) | radix-2 FFT, Hann, spectrum, trigger, resample | `apps/vyzorWeb/src/lib/scope-dsp.ts` |
| DSP — TS (utils, duplicate) | RMS, peak, DC, frequency, downsample, CSV/WAV export | `packages/api-client/src/domain/_shared/audio-utilities.ts` |
| Audio capture (server) | cpal-only capture + stream manager | `rust/src/infrastructure/{audio_capture_real,audio_stream_manager}.rs` |
| Rendering | Canvas2D only | `apps/vyzorWeb/src/components/scope/scope-canvas.tsx` |
| Mobile | config-only shell, no source | `apps/vyzorMobile/` (9 config files, no `app/`) |
| Server DSP API | `schema_dsp.rs` resolvers compute in Rust | `rust/src/api/schema_dsp.rs` (477 lines) |
| Transport/storage | GraphQL + WS + Turso/SQLite + device scoping — **keep** | `rust/src/api/`, `rust/src/infrastructure/` (repos), `rust/migrations/` |
| C++ core | none | — |

**Duplications to eliminate** (Rust ↔ TS, same algorithm twice):
`compute_magnitudes`↔`computeSpectrum`, `analyze_waveform`↔`audio-utilities` (RMS/peak/DC/freq),
`TriggerDetector`↔`findTriggerIndex`, `lz4`↔(none yet TS), generators↔(mock analyzer).
A third near-copy (`use-mock-audio-analyzer.ts`, 390 lines) synthesizes waveforms in TS —
also replaced by the C++ generators via WASM.

---

## 2. Target file tree (new + changed)

Legend: `[N]` new, `[M]` modify, `[D]` delete, `[K]` keep as-is.

```
audio-scope-view/
├── sdk/                                      [N] entire directory — C++ core/bindings/wasm/firmware
│   ├── CMakeLists.txt                         [N]
│   ├── CMakePresets.json                      [N]
│   ├── cppcheck-suppressions.txt              [N]
│   ├── common/                                [N]
│   │   ├── CMakeLists.txt                     [N]
│   │   ├── include/audioscope/common/
│   │   │   ├── types.hpp                      [N] AudioDevice, SampleFormat, Span, SampleBuffer
│   │   │   ├── buffer.hpp                     [N] ring buffer + pool allocator
│   │   │   ├── config.hpp                     [N] DspConfig
│   │   │   └── audio_binding.hpp             [N] abstract AudioBinding interface
│   │   └── src/{buffer,config}.cpp            [N]
│   ├── dsp/                                   [N]
│   │   ├── CMakeLists.txt                     [N] libaudioscope_dsp (static)
│   │   ├── include/audioscope/dsp/
│   │   │   ├── dsp.hpp                        [N] AudioProcessor facade
│   │   │   ├── fft.hpp                        [N] FftProcessor, WindowType, Spectrum
│   │   │   ├── measurements.hpp               [N] WaveformAnalysis, HarmonicAnalysis
│   │   │   ├── spectrogram.hpp                [N] SpectrogramProcessor
│   │   │   ├── corrections.hpp                [N] DC/inverse-FR/noise-gate/AGC
│   │   │   ├── trigger.hpp                    [N] TriggerDetector
│   │   │   ├── compression.hpp                [N] LZ4 wrappers
│   │   │   └── generators.hpp                 [N] sine/square/saw/triangle/noise
│   │   └── src/{dsp,fft,measurements,spectrogram,corrections,trigger,compression,generators}.cpp  [N]
│   ├── bindings/
│   │   ├── linux/{CMakeLists.txt,alsa_binding.cpp,pulse_binding.cpp}      [N]
│   │   ├── windows/{CMakeLists.txt,wasapi_binding.cpp}                    [N]
│   │   ├── android/{CMakeLists.txt,jni_bridge.cpp,oboe_capture.cpp}      [N]
│   │   └── ffi/{CMakeLists.txt,rust_cxx_bridge.h}                         [N]
│   ├── wasm/
│   │   ├── CMakeLists.txt                     [N] emcc toolchain
│   │   ├── emscripten_main.cpp                [N] flat C ABI exports
│   │   └── build.sh                           [N]
│   ├── firmware/esp32/                        [N] UAC firmware (separate build)
│   │   ├── CMakeLists.txt                     [N] ESP-IDF
│   │   ├── main.c                             [N] TinyUSB UAC descriptors + I2S codec read
│   │   └── README.md                          [N] wiring / codec notes
│   └── tests/
│       ├── CMakeLists.txt                     [N] GoogleTest
│       └── test_{fft,measurements,spectrogram,corrections,trigger,generators}.cpp  [N]
│
├── packages/
│   ├── dsp-wasm/                              [N] entire package — TS WASM wrapper + worklet
│   │   ├── package.json                        [N] name @audio-scope-view/dsp-wasm
│   │   ├── tsconfig.json                       [N]
│   │   ├── src/
│   │   │   ├── index.ts                        [N] exports AudioScopeDsp
│   │   │   ├── audioscope-dsp.ts               [N] WASM loader + typed wrappers (ccall/cwrap)
│   │   │   ├── types.ts                        [N] Spectrum, WaveformAnalysis, etc. TS types
│   │   │   └── worklets/
│   │   │       ├── dsp-processor.js            [N] AudioWorkletProcessor (real-time thread)
│   │   │       └── dsp-processor.d.ts          [N]
│   │   └── dist/  (build output: audioscope.js/wasm copied from sdk/wasm build)
│   ├── api-client/                             [M] keep transport; remove duplicated DSP utils
│   ├── config/, eslint/, tailwind/, tamagui/, ui/, ui-radix/                  [K]
│
├── apps/
│   ├── vyzorWeb/
│   │   ├── src/lib/webgl/                      [N] WebGL2 renderer (replaces Canvas2D path)
│   │   │   ├── scope-renderer.ts               [N] line scope draw (instanced)
│   │   │   ├── spectrum-renderer.ts            [N] spectrum bars / texture
│   │   │   ├── spectrogram-renderer.ts         [N] 2D texture waterfall
│   │   │   ├── gl-context.ts                   [N] WebGL2 context + program cache
│   │   │   └── shaders/
│   │   │       ├── line.vert / line.frag       [N]
│   │   │       ├── spectrum.vert / spectrum.frag [N]
│   │   │       └── spectrogram.vert / spectrogram.frag [N]
│   │   ├── src/lib/scope-dsp.ts                [D] replaced by @audio-scope-view/dsp-wasm
│   │   ├── src/components/scope/scope-canvas.tsx  [M] swap Canvas2D for WebGL renderer
│   │   ├── src/hooks/use-audio-analyzer.ts     [M] route to dsp-wasm instead of TS FFT
│   │   ├── src/hooks/use-mock-audio-analyzer.ts [D] use C++ generators via WASM
│   │   ├── src/audio/                          [M] repoint worklet to dsp-wasm
│   │   └── package.json, vite.config.ts        [M] add dsp-wasm + regl deps
│   └── vyzorMobile/
│       ├── app/                                [N] full RN app (routes/components/hooks/store)
│       ├── android/                            [N] generated by expo prebuild + JSI turbo module
│       │   └── app/src/main/java/com/audioscope/dsp/{DspModule.java,DspModule.kt}  [N] JSI bridge
│       ├── ios/                                [N] generated (Apple platform — out of first scope)
│       ├── package.json                        [M] eject to bare RN 0.76+, add react-native-reanimated/oboe deps
│       ├── app.json                            [M] add New Architecture flags
│       ├── metro.config.js                     [M] add babel-macros / monorepo watch for sdk
│       └── ARCHITECTURE.md                     [M] document JSI/DSP module
│
├── rust/
│   ├── Cargo.toml                              [M] add cxx + cc; remove rustfft, num-complex; (rand if unused)
│   ├── build.rs                                [N] compile C++ core + FFI via cc/cmake
│   ├── src/infrastructure/dsp_ffi.rs           [N] cxx bridge to C++ AudioProcessor
│   ├── src/api/schema_dsp.rs                   [M] resolvers call FFI instead of Rust DSP
│   ├── src/domain/fft_processor.rs             [D]
│   ├── src/domain/measurements.rs               [D]
│   ├── src/domain/spectrogram.rs                [D]
│   ├── src/domain/waveform_generators.rs       [D]
│   ├── src/domain/trigger/{mod.rs,detector.rs} [D]
│   ├── src/domain/compression/mod.rs           [D]
│   ├── src/domain/mod.rs                       [M] remove deleted module re-exports
│   ├── src/infrastructure/audio_capture_real.rs  [K] server-side cpal capture (unchanged)
│   ├── src/infrastructure/audio_stream_manager.rs [K] unchanged
│   └── all other api/application/infrastructure/shared   [K] transport/storage/auth unchanged
│
├── docs/
│   ├── ARCHITECTURE.md                         [M] rewritten (v3.0)
│   └── ARCHITECTURE_IMPLEMENTATION_SPEC.md     [N] this document
│
└── root build/config
    ├── package.json                            [M] add dsp-wasm to workspaces scripts; build:wasm task
    ├── pnpm-workspace.yaml                     [K] packages/* + apps/* already covers dsp-wasm
    ├── turbo.json                              [M] add build:wasm + build:sdk tasks
    ├── Dockerfile                              [M] add emscripten + cmake stages for WASM/C++ artifacts
    └── render.yaml                             [K] (server build gets C++ via cargo build — no change)
```

---

## 3. Per-section plans (new / modify / delete)

### Section A — `sdk/` C++ DSP core + bindings + WASM + firmware

All files NEW. Build order: common → dsp → tests → bindings → wasm → ffi → firmware.

#### A.1 Build system
- `sdk/CMakeLists.txt` — top-level; `add_subdirectory(common dsp tests)`, conditional
  `add_subdirectory(bindings/...)` by preset, `add_subdirectory(wasm)` only under
  Emscripten, `add_subdirectory(firmware/esp32)` only under ESP-IDF.
- `sdk/CMakePresets.json` — presets: `linux`, `windows`, `android-arm64`, `android-armv7`,
  `android-x86_64`, `wasm`, `ffi-rust`. Each sets toolchain file + arch flags.
- `sdk/cppcheck-suppressions.txt`.

#### A.2 `sdk/common/` — types, ring buffer, config, AudioBinding interface
- `include/audioscope/common/types.hpp` — `AudioDevice{std::string id,name; uint32_t channels, sample_rate; bool is_default}`,
  `SampleFormat` enum, `Span<T>` (non-owning view), `SampleBuffer` (owning `std::vector<float>`).
- `include/audioscope/common/buffer.hpp` — `AudioRingBuffer<T>` (lock-free SPSC), `PoolAllocator<T>`.
- `include/audioscope/common/config.hpp` — `DspConfig{float sample_rate; int block_size; int fft_size; WindowType window_type; float overlap; float min_freq,max_freq;}` with `from_json`.
- `include/audioscope/common/audio_binding.hpp` — abstract `AudioBinding`:
  `enumerate_devices() -> std::vector<AudioDevice>`, `start_capture(device_id, sample_rate) -> bool`,
  `stop_capture()`, `read_samples(float* buf, size_t count) -> bool`.
- `src/buffer.cpp`, `src/config.cpp`.

#### A.3 `sdk/dsp/` — the algorithms (migrate from Rust + TS)
Headers + impls for: `dsp.hpp`, `fft.hpp`, `measurements.hpp`, `spectrogram.hpp`,
`corrections.hpp`, `trigger.hpp`, `compression.hpp`, `generators.hpp` and matching `.cpp`.
Migration source mapping (one C++ source per Rust/TS file — no second copy remains):
| C++ file | Migrate from (Rust) | Migrate from (TS) | Notes |
|---|---|---|---|
| `fft.cpp` | `rust/src/domain/fft_processor.rs` (FftProcessor, compute_magnitudes, find_peak_frequency, compute_spectrum, WindowType) | `apps/vyzorWeb/src/lib/scope-dsp.ts` (`fft`, `computeSpectrum`, `nextPowerOfTwo`, Hann window) | Reconcile the two FFTs: TS uses in-place radix-2 on `Float32Array`; Rust uses `rustfft`. Output a single radix-2 + SIMD path. Keep Rust's `Spectrum` struct shape (frequencies/magnitudes_db/peak_*/bins). |
| `measurements.cpp` | `rust/src/domain/measurements.rs` (analyze_waveform, find_peak_amplitude, find_negative_peak_amplitude, compute_rms, compute_dc_offset, zero_crossing_rate, estimate_dominant_frequency, estimate_thd_snr, analyze_harmonics, amplitude_to_db, db_to_amplitude, peak_to_dbfs, rms_to_dbfs, crest_factor_db, snr_to_db) | `packages/api-client/src/domain/_shared/audio-utilities.ts` (calculateRMS, calculatePeak, calculateDCOffset, calculateFrequency) | Two THD algorithms exist (Rust `estimate_thd_snr` harmonic-sum vs the harmonic-analysis path). Standardize on the harmonic-analysis THD; keep `estimate_thd_snr` as a fast-path alias. |
| `spectrogram.cpp` | `rust/src/domain/spectrogram.rs` (SpectrogramProcessor, SpectrogramConfig, SpectrogramData, to_image_data) | — | |
| `corrections.cpp` | (DC parts from `measurements.rs`) + new | — | `correct_dc_offset` from existing DC logic; `normalize_peak`, `apply_inverse_frequency_response`, `interpolate_noise_gates`, `estimate_agc` are NEW (currently only described, not implemented). |
| `trigger.cpp` | `rust/src/domain/trigger/detector.rs` (TriggerDetector) | `apps/vyzorWeb/src/lib/scope-dsp.ts` (findTriggerIndex, triggeredWindow) | Rust `trigger/detector.rs` is currently unused/dead — its logic is what to port; the TS version is the live one. Port once. |
| `compression.cpp` | `rust/src/domain/compression/mod.rs` (LZ4) | — | Half-implemented today; complete compress/decompress round-trip + tests. |
| `generators.cpp` | `rust/src/domain/waveform_generators.rs` (sine/square/sawtooth/triangle/white_noise/pink_noise/brown_noise + generate) | `apps/vyzorWeb/src/hooks/use-mock-audio-analyzer.ts` (synthesis) | Replace the TS mock synthesizer with the C++ generators via WASM. |
| `dsp.cpp` | (new facade) | — | `AudioProcessor` owns an `FftProcessor` + `SpectrogramProcessor` + `TriggerDetector`; `process_frame` runs the configured pipeline. |

#### A.4 `sdk/bindings/` — platform audio capture
- `linux/alsa_binding.cpp` — ALSA (`snd_pcm_*`). Deps (build): `libasound2-dev`, `pkg-config`.
- `linux/pulse_binding.cpp` — PulseAudio simple API; reads `auto_null.monitor` for headless. Deps: `libpulse-dev`.
- `windows/wasapi_binding.cpp` — WASAPI capture (`IMMDeviceEnumerator`, `IAudioCaptureClient`). Deps: Windows SDK only.
- `android/jni_bridge.cpp` — `extern "C"` JNI exports for `DspModule` (create/process/measurements/destroy) + Oboe callbacks. Deps: Oboe (fetched on demand at CMake configure via `FetchContent`, pinned to 1.9.0 in `sdk/bindings/android/CMakeLists.txt`), NDK r25+.
- `android/oboe_capture.cpp` — `oboe::AudioStreamBuilder` input stream, 1 ch f32, processing disabled.
- `ffi/rust_cxx_bridge.h` — header included by the `cxx`-generated `rust/src/infrastructure/dsp_ffi.rs`.

#### A.5 `sdk/wasm/` — Emscripten build
- `emscripten_main.cpp` — wraps `AudioProcessor` and exports the flat C ABI listed in ARCHITECTURE.md §WASM. Uses `EMSCRIPTEN_KEEPALIVE`.
- `CMakeLists.txt` — `emcc` flags, SIMD, MODULARIZE, EXPORT_ES6, output `audioscope.{js,wasm}`.
- `build.sh` — `emcmake cmake -B build-wasm ... && emmake cmake --build build-wasm`; copies outputs to `packages/dsp-wasm/dist/`.

#### A.6 `sdk/firmware/esp32/` — ESP32 firmware (bare-USB vendor class, NOT UAC)

Design decision: the ESP32 presents a **custom vendor-class USB device**, not a
UAC device. The host talks to it directly via libusb (`sdk/bindings/usb/`),
bypassing the OS audio stack. See `docs/ESP32_USB_PROTOCOL.md` for the wire
protocol. Separate build (`idf.py`), not in the host CI critical path; firmware
sources are syntax-checked on the host with stub ESP-IDF headers.

- `CMakeLists.txt` — ESP-IDF project (`include($ENV{IDF_PATH}/.../project.cmake OPTIONAL)` so it browses without IDF).
- `partitions.csv` — flash partition table.
- `sdkconfig.defaults` — USB OTG + TinyUSB vendor class + I2S + PSRAM Kconfig defaults.
- `idf_component.yml` — component manifest.
- `main/main.c` — `app_main`: init USB → codec → ring → control/stream tasks.
- `main/usb_descriptors.c` — TinyUSB device + config descriptors (vendor class, bulk IN 0x81 + OUT 0x01).
- `main/usb_device.c/.h` — TinyUSB vendor-class callbacks (EP0 control + bulk IN/OUT events).
- `main/codec.c/.h` — I2S codec driver (PCM1802 default; UDA1334A/WM8731 swap-point).
- `main/ring_buffer.c/.h` — FreeRTOS ring between DMA-read and USB bulk-IN tasks.
- `main/stream_task.c/.h` — codec → ring → bulk-IN pump.
- `main/control_task.c/.h` — host command dispatcher (start/stop/set_rate/...).
- `main/board_config.h` — pin map + USB endpoint config.
- `README.md` — wiring, codec choice, analog front-end, build/flash.

#### A.6b `sdk/bindings/usb/` — host `AudioBinding` over libusb (the bare-ESP32 path)

- `usb_protocol.h` / `usb_protocol.c` — shared wire protocol + CRC-16 (single source for firmware + host + tests).
- `usb_binding.h` / `usb_binding.cpp` — `UsbCapture : AudioBinding` (libusb enumerate / control / bulk-IN → float32).
- `CMakeLists.txt` — `audioscope_bindings_usb` static lib, gated on `pkg-config libusb-1.0` (cross-platform).
- `README.md` — host libusb setup, VID/PID, udev rule.

#### A.6c `docs/ESP32_USB_PROTOCOL.md` — authoritative wire-protocol spec.

#### A.6d `sdk/tests/test_usb_binding.cpp` — protocol ABI (sizeof/offsetof) + CRC vector + no-hardware binding smoke.

#### A.7 `sdk/tests/` — GoogleTest
- `test_fft.cpp`, `test_measurements.cpp`, `test_spectrogram.cpp`, `test_corrections.cpp`,
  `test_trigger.cpp`, `test_generators.cpp`. Use the same test vectors as the existing
  Rust tests in `rust/tests/` (port assertions) so parity is provable.

### Section B — `packages/dsp-wasm/` (NEW)

- `package.json` — name `@audio-scope-view/dsp-wasm`, `type: module`, main `./src/index.ts`,
  exports `.` and `./worklets/dsp-processor`. No runtime deps; devDeps: typescript, vite (for worklet bundling).
- `src/index.ts` — re-exports `AudioScopeDsp`.
- `src/audioscope-dsp.ts` — `AudioScopeDsp` class: `load()` instantiates the WASM module
  (from `dist/audioscope.js`), then methods `processFrame`, `getMeasurements`, `getSpectrum`,
  `computeSpectrogram`, `analyzeHarmonics`, `findTrigger`, `lz4Compress`, `lz4Decompress`,
  `generateWaveform` allocate into `HEAPF32`, call the C ABI via `ccall`/`cwrap`, copy out.
- `src/types.ts` — TS interfaces mirroring the C++ structs (`Spectrum`, `WaveformAnalysis`,
  `HarmonicAnalysis`, `SpectrogramData`, `TriggerOptions`, `TriggerResult`).
- `src/worklets/dsp-processor.js` — `AudioWorkletProcessor` that loads the WASM module in
  the worklet scope, processes `process()` inputs through `AudioScopeDsp`, posts results to main.
- `src/worklets/dsp-processor.d.ts` — type declarations.
- `dist/` — build output (`audioscope.js`, `audioscope.wasm`) copied from `sdk/wasm/build-wasm/` by the `build:wasm` task.

### Section C — `apps/vyzorWeb/` (MODIFY: WebGL + dsp-wasm)

#### C.1 NEW — WebGL2 renderer (`src/lib/webgl/`)
- `gl-context.ts` — get/create a WebGL2 context, program cache, resize/DPR handling.
- `scope-renderer.ts` — instanced line rendering for the scope trace. Input: `Float32Array`
  samples → vertex buffer → single `drawArrays`. Replaces the per-frame `ctx.lineTo` loop
  in `scope-canvas.tsx`.
- `spectrum-renderer.ts` — spectrum bars via instanced quads or 1D texture.
- `spectrogram-renderer.ts` — 2D waterfall texture updated each time slice.
- `shaders/` — `line.{vert,frag}`, `spectrum.{vert,frag}`, `spectrogram.{vert,frag}`.
- Deps to add (`apps/vyzorWeb/package.json`): `@audio-scope-view/dsp-wasm` (workspace),
  `regl` (or raw WebGL2 — decide; regl is the safer default), `gl-matrix` (mat4 for camera).

#### C.2 DELETE
- `apps/vyzorWeb/src/lib/scope-dsp.ts` — replaced by `@audio-scope-view/dsp-wasm`.
- `apps/vyzorWeb/src/hooks/use-mock-audio-analyzer.ts` — replaced by C++ generators via dsp-wasm.

#### C.3 MODIFY
- `apps/vyzorWeb/src/components/scope/scope-canvas.tsx` — replace the `getContext("2d")`
  + `drawSpectrum`/`drawSpectrum`/`requestAnimationFrame` path with the WebGL renderer.
  The component keeps its props surface (samples, config, colors, trigger options) so
  `scope-page.tsx` and `use-scope-capture` are untouched. Internal draw functions
  (`drawSpectrum`, the line draw loop) are removed; the renderer classes take over.
- `apps/vyzorWeb/src/hooks/use-audio-analyzer.ts` — route FFT/measurements to `AudioScopeDsp`
  from `@audio-scope-view/dsp-wasm` instead of the local `scope-dsp.ts` functions.
- `apps/vyzorWeb/src/audio/use-streaming-playback.ts` + `apps/vyzorWeb/src/audio/worklets/audio-streaming-processor.js` —
  repoint to `@audio-scope-view/dsp-wasm/worklets/dsp-processor` (the new worklet) or keep
  the existing playback worklet and only swap the analyzer path. Decide during impl; the
  analyzer path is the priority.
- `apps/vyzorWeb/src/store/waveform-store.ts` — ensure sample buffers are NOT stored in React
  state on the hot path (they go DSP → WebGL buffer directly). Adjust if the store currently
  holds raw sample arrays used by the renderer.
- `apps/vyzorWeb/package.json` — add deps (above).
- `apps/vyzorWeb/vite.config.ts` — add `optimizeDeps.include: ["@audio-scope-view/dsp-wasm"]`
  and ensure `.wasm` assets are served (Vite handles this; confirm `assetsInclude`).
- `apps/vyzorWeb/scripts/static-server.cjs` — serve `packages/dsp-wasm/dist/*.wasm` with
  the correct `application/wasm` MIME (add a route if not handled by the static fallback).

### Section D — `apps/vyzorMobile/` (REBUILD: bare RN + JSI)

Current state: config-only (no `app/`). Target: bare/prebuilt RN 0.76+ New Architecture.

#### D.1 NEW
- `apps/vyzorMobile/app/` — full RN app: `routes/`, `components/`, `hooks/`, `store/`
  (mirror the planned tree in its `ARCHITECTURE.md` but built against the new DSP module).
  Reuse `packages/api-client`, `packages/ui` (Tamagui) where possible.
- `apps/vyzorMobile/android/` — generated by `expo prebuild --platform android`, then
  customized:
  - `android/app/src/main/java/com/audioscope/dsp/DspModule.{kt,java}` — JSI TurboModule
    that loads `libaudioscope_dsp.so` and exposes `processFrame`/`measurements`/`spectrum`
    to JS via the C++ JNI bridge in `sdk/bindings/android/jni_bridge.cpp`.
  - `android/app/build.gradle` — `externalNativeBuild { cmake { path "../../../../../sdk/bindings/android/CMakeLists.txt" } }`,
    `ndkVersion`, `abiFilters arm64-v8a armeabi-v7a x86_64`, `arguments "-DANDROID_STL=c++_shared"`.
  - `android/app/src/main/AndroidManifest.xml` — `RECORD_AUDIO` permission (already has INTERNET).
- `apps/vyzorMobile/ios/` — generated by prebuild (Apple platform — JSI works, but the
  first implementation scope is Android; iOS binder added later).

#### D.2 MODIFY
- `apps/vyzorMobile/package.json` — bump `react-native` to 0.76+ (New Architecture),
  add `react-native-reanimated`, `oboe` (AAR or vendor), remove expo managed-only deps
  that conflict with bare RN. Keep EAS build scripts.
- `apps/vyzorMobile/app.json` — set `"newArchEnabled": true` (android), remove expo-build-properties
  managed-only usage if it conflicts, add `android.packagingOptions` for the native lib.
- `apps/vyzorMobile/metro.config.js` — ensure `sdk/` is in `watchFolders` + `nodeModulesPaths`
  (for the CMake build asset visibility); keep Tamagui plugin.
- `apps/vyzorMobile/babel.config.js` — fix the stale `packages/ui/src/tamagui.config.ts` path.
- `apps/vyzorMobile/tsconfig.json` — fix the `@vyzorix/*` vs `@audio-scope-view/*` naming
  mismatch (align to `@audio-scope-view/*` used everywhere else).
- `apps/vyzorMobile/ARCHITECTURE.md` — document the JSI DSP module + Oboe capture path.

#### D.3 DELETE
- `apps/vyzorMobile/index.js` (references a nonexistent `./App`) — replaced by the real
  app entry under `app/`.

### Section E — `rust/` server (MODIFY: remove DSP, add FFI)

#### E.1 NEW
- `rust/build.rs` — compile `sdk/dsp` + `sdk/common` + `sdk/bindings/ffi` as a static lib
  using the `cc` crate (or shell out to `cmake` with the `ffi-rust` preset), link into the
  server binary. Set `LD_LIBRARY_PATH`/`DYLD_LIBRARY_PATH` notes in docs.
- `rust/src/infrastructure/dsp_ffi.rs` — `cxx` bridge:
  ```rust
  #[cxx::bridge]
  mod ffi {
      unsafe extern "C++" {
          include!("audioscope/dsp/dsp.hpp");
          type AudioProcessor;
          fn new_processor(sample_rate: f32, block_size: i32) -> UniquePtr<AudioProcessor>;
          fn process_frame(self: &AudioProcessor, in: &[f32], out: &mut [f32]);
          // ...measurements/spectrum/spectrogram/harmonics/trigger wrappers
      }
  }
  ```
  Wraps the C++ `AudioProcessor` so `schema_dsp.rs` resolvers use the same core as clients.

#### E.2 MODIFY
- `rust/Cargo.toml` — add `cxx = "1.2"`, `cc = "1.0"` (build-dep); remove `rustfft`, `num-complex`.
  Keep `lz4` only if non-DSP Rust code still uses it (compression moves to C++); otherwise remove.
  Keep `cpal`, `rand` (rand only if non-DSP randomness remains; otherwise remove).
- `rust/src/api/schema_dsp.rs` — the 5 resolvers (`fft_analyze`, `analyze_waveform`,
  `compute_spectrogram`, `analyze_harmonics`, `process_audio`) call `dsp_ffi::ffi::*`
  instead of `rust/src/domain/*`. The output DTOs (`SpectrumResult`, `WaveformMeasurementResult`,
  `SpectrogramResult`, `HarmonicAnalysisResult`, `ProcessAudioResult`) stay the same shape,
  so the GraphQL surface is unchanged for existing clients.
- `rust/src/domain/mod.rs` — remove `pub mod fft_processor; pub mod measurements; pub mod spectrogram; pub mod waveform_generators; pub mod trigger; pub mod compression;` re-exports.
- `rust/src/application/simulation_service.rs` — if it uses `WaveformGenerator` from Rust,
  route to the FFI generators instead (or keep a thin Rust shim that calls FFI).
- `rust/src/lib.rs` — remove re-exports of deleted DSP types (`AudioBackendType` stays).
- `rust/migrations/` — UNCHANGED (no schema changes; DSP removal is code-only).
- `rust/src/api/{schema_session,schema_recording,schema_waveform,...}.rs` — UNCHANGED
  (transport/storage surface stays; only `schema_dsp.rs` resolvers change their backing).

#### E.3 DELETE (Rust DSP — migrated to C++, no parallel copy)
- `rust/src/domain/fft_processor.rs`
- `rust/src/domain/measurements.rs`
- `rust/src/domain/spectrogram.rs`
- `rust/src/domain/waveform_generators.rs`
- `rust/src/domain/trigger/mod.rs`
- `rust/src/domain/trigger/detector.rs`
- `rust/src/domain/trigger/` (whole dir, both files)
- `rust/src/domain/compression/mod.rs`
- `rust/src/domain/compression/` (whole dir)
- `rust/tests/domain/test_scope_entity.rs` — only if it asserts on deleted DSP; verify before delete.

### Section F — root build/config

#### F.1 MODIFY
- `package.json` — add scripts: `"build:wasm": "bash sdk/wasm/build.sh"`,
  `"build:sdk": "cmake --preset linux -B sdk/build && cmake --build sdk/build"`,
  `"test:sdk": "cd sdk/build && ctest"`. `build` script depends on `build:wasm` first
  (so the web app bundles the fresh WASM).
- `turbo.json` — add tasks `build:wasm` (cache:false, persistent env), `build:sdk` (outputs `sdk/build/**`), `test:sdk`.
- `pnpm-workspace.yaml` — UNCHANGED (`packages/*` already includes `packages/dsp-wasm`).
- `Dockerfile` — add an `emscripten` stage that builds `sdk/wasm` and copies
  `audioscope.{js,wasm}` into `packages/dsp-wasm/dist/` before the frontend-builder stage;
  add a `cmake` install to the backend-builder stage for the FFI static lib. Update
  `docker-compose*.yml` only if build args change.
- `render.yaml` — UNCHANGED (the Rust build picks up C++ via `build.rs`; the frontend
  build needs the WASM artifacts — ensure the Render build image has emscripten, or
  pre-build WASM in CI and commit the artifact, or add an emscripten install step).
- `.env.example` — UNCHANGED (no new env vars; local mode needs none).

---

## 4. Implementation sequencing (do in this order to keep the tree green)

1. **C++ core + tests** (§A.2, A.3, A.7) — build `sdk/dsp` + `sdk/common`, port algorithms
   from Rust/TS, GoogleTest parity with `rust/tests/`. No wiring yet. CI: `test:sdk` passes.
2. **Rust FFI + server DSP removal** (§E) — add `cxx` bridge, repoint `schema_dsp.rs`,
   delete Rust DSP files. CI: `cargo test` passes (DSP now via FFI). This proves the C++
   core is correct against the existing server tests.
3. **WASM build + `packages/dsp-wasm`** (§A.5, §B) — emscripten build, TS wrapper, worklet.
   CI: a vitest that loads the WASM module in Node and runs an FFT against a known vector.
4. **WebGL renderer + web swap** (§C) — new `src/lib/webgl/`, swap `scope-canvas.tsx`,
   delete `scope-dsp.ts` + `use-mock-audio-analyzer.ts`, repoint `use-audio-analyzer.ts`.
   CI: web build + a Playwright smoke test that the scope renders a non-empty WebGL canvas.
5. **Mobile eject + JSI** (§D) — `expo prebuild`, add `DspModule`, Oboe capture, build the
   RN app under `app/`. CI: Android EAS build succeeds; an instrumented test calls the JSI
   module and returns a measurement.
6. **Native bindings** (§A.4 linux/windows) — ALSA + WASAPI bindings for a native Linux/Windows
   client (the server already covers Linux via cpal; this is for a desktop client app).
7. **ESP32 firmware** (§A.6) — UAC firmware; flash, verify it enumerates as a mic on
   Linux/Windows/Android, then confirm the existing audio binding picks it up.
8. **Server-optional local mode** — local persistence (SQLite for native, IndexedDB for web)
   + sync; wire into the UI mode switch. Last, since it depends on all capture paths working.
   - **Mobile (implemented):** the vyzorMobile app persists sessions to an on-device
     Android Room SQLite store (`com.audioscope.data`) when `persistenceMode === "local"`,
     and syncs dirty rows to the deployed server via `useLocalSync` (Apollo mutations).
     See `apps/vyzorMobile/ARCHITECTURE.md` → "Server-optional local mode". Settings →
     Storage toggles server/local. No IndexedDB on the web path (web already persists via
     the Rust server's Turso/local SQLite — Step 8 is mobile-only here).

Each step compiles and tests independently. Steps 1–2 unlock the rest; step 3 unlocks 4;
step 4 + 5 unlock 6–7.

---

## 5. Toolchain install (CI + local)

- **C++:** CMake ≥ 3.21; GCC 11+ or Clang 13+ (Linux), MSVC 2022 (Windows), NDK r25+ (Android).
- **Emscripten:** EMSDK 3.1.40+; CI step: `git clone https://github.com/emscripten-core/emsdk && emsdk install latest && emsdk activate latest && source emsdk_env.sh`.
- **Android:** Android SDK + NDK r25+, Oboe (fetched on demand at CMake configure via `FetchContent` pinned to 1.9.0 — no vendored tree, no Gradle dep).
- **Rust:** `nightly-2026-07-20` (unchanged), plus `cxx` + `cc` crates (no toolchain change).
- **ESP-IDF:** v5.x (only for firmware; separate Docker image / not in the main CI).
- **Linux audio build deps:** `libasound2-dev`, `pkg-config`, `libpulse-dev` (already in Dockerfile backend-builder).
- **GoogleTest:** fetched via CMake `FetchContent`.

---

## 6. Known hazards (avoid these — they've bitten before)

1. **Don't keep a second DSP copy.** The temptation is to leave the Rust DSP "for now".
   Don't. Step 2 deletes it after the FFI path is proven; otherwise drift returns.
2. **Two THD algorithms exist** (`measurements.rs::estimate_thd_snr` harmonic-sum vs the
   harmonic-analysis path in `analyze_harmonics`). Pick one (harmonic-analysis) in C++;
   make the fast path an alias. Document the choice in `sdk/dsp/src/measurements.cpp`.
3. **FFT zero-pad inconsistency:** TS `computeSpectrum` pads to next pow2; Rust
   `compute_magnitudes` uses `rustfft` on a fixed size. Standardize on pow2-padding in C++.
4. **Trigger:** the Rust `trigger/detector.rs` is dead code; the live trigger is the TS
   `findTriggerIndex`. Port the TS logic (it's the correct one) into C++ `trigger.cpp`,
   then delete both.
5. **Compression half-implemented:** `rust/src/domain/compression/mod.rs` is incomplete.
   Complete the round-trip in C++ and add a round-trip test before deleting the Rust file.
6. **Mobile naming mismatch:** `@vyzorix` vs `@audio-scope-view` vs `@vyzoriX`. Align
   everything to `@audio-scope-view/*` during the mobile rebuild (§D.2).
7. **Expo managed vs bare RN:** do NOT attempt the JSI C++ module under Expo managed.
   Run `expo prebuild --platform android` and commit the `android/` dir; New Architecture
   must be enabled (`newArchEnabled: true`).
8. **VITE_* build-time vars:** unchanged, but the WASM artifact path is a build-time
   concern — the web `build` script must run `build:wasm` first so `packages/dsp-wasm/dist/`
   is populated before Vite bundles.
9. **`static-server.cjs` MIME:** `.wasm` must be served as `application/wasm` or the browser
   rejects streaming compile. Add the MIME if the static fallback doesn't set it.
10. **Server Turso fallback:** unchanged — DSP removal is code-only, no DB migration.
    Do NOT touch `migrations/` or any repo file.
11. **WebGL fallback:** provide a Canvas2D fallback only if a platform lacks WebGL2 (rare
    post-2020). Default to WebGL2; gate the fallback on a `gl = canvas.getContext('webgl2')`
    null check. Decide during step 4.
12. **Sample buffers in React state:** the current `waveform-store.ts` may hold raw arrays
    the Canvas2D path reads each frame. The WebGL path must take buffers by reference into
    the vertex buffer, not via React re-renders. Audit the store during step 4.

---

## 7. What is explicitly NOT changed

- GraphQL schema surface (queries/mutations/subscriptions) — only `schema_dsp.rs`
  resolver *bodies* change (to FFI); types/shapes are identical.
- WebSocket protocol (`/ws` legacy + `/graphql/ws` Apollo) — unchanged.
- Migrations / DB schema — unchanged.
- Device-id scoping / auth — unchanged.
- `packages/api-client` transport layer (graphql/websocket) — unchanged.
- `packages/ui`, `packages/ui-radix`, `packages/tamagui` — unchanged.
- `rust/src/infrastructure/{audio_capture_real,audio_stream_manager}.rs` — unchanged
  (server-side cpal capture stays for the server-hosted `capture` mutation).

---

*Document Version: 1.0*
*Last Updated: 2026-08-10*
