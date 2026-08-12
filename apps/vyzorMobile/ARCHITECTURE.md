# VyzorMobile - Mobile Application Architecture

> **Version:** 2.0
> **Status:** Implemented (spec §D)
> **Last Updated:** 2026-08-11

---

## Overview

This document covers the mobile-specific architecture. For shared architecture
patterns, hooks structure, and data layer details, see
[apps/vyzorWeb/ARCHITECTURE.md](../vyzorWeb/ARCHITECTURE.md).

The mobile app is a **bare/prebuilt React Native 0.76 app on the New
Architecture** (Hermes + JSI). Audio capture runs through **Oboe**
(AAudio/OpenSL ES) and all DSP (FFT, measurements, spectrum) runs in the
shared **C++ core** (`sdk/dsp`) invoked through a **JSI-adjacent native
module** (`DspModule`) over JNI — there is **no JS-side FFT** and **no
expo-av** on the capture path. The styling layer is **NativeWind v4**
(Tailwind v3 engine) reusing the web's `@audio-scope-view/tailwind` preset and
the `cn()`/`cva` component pattern from `@audio-scope-view/ui-radix`.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      MOBILE ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────┘

                         ┌─────────────────────┐
                         │      UI LAYER       │
                         │  (apps/vyzorMobile/  │
                         │       app/routes,    │
                         │       components)    │
                         │  ONLY renders UI.    │
                         │  Uses hooks.        │
                         └─────────────────────┘
                                    uses ↓
                         ┌─────────────────────┐
                         │  PRESENTATION LAYER │
                         │  app/hooks/         │
                         │  use-mobile-audio   │
                         │  use-mobile-scope   │
                         └─────────────────────┘
                              uses ↓     ↓
        ┌──────────────────────┐   ┌──────────────────────────┐
        │  STORE LAYER         │   │  NATIVE DSP LAYER        │
        │  app/store/          │   │  sdk/dsp + sdk/bindings/ │
        │  scope-store         │   │  DspModule.kt (JNI)      │
        │  settings-store      │   │  jni_bridge.cpp          │
        │  ui-store            │   │  oboe_capture.cpp        │
        └──────────────────────┘   │  → libaudioscope_dsp.so  │
                                   └──────────────────────────┘
                                              uses ↓
                         ┌─────────────────────────────┐
                         │  SHARED DOMAIN/DATA LAYER   │
                         │  packages/api-client/src/   │
                         └─────────────────────────────┘
```

---

## The JSI DSP Module (§D.1)

The C++ DSP core (`sdk/dsp`) is exposed to JS through a flat C ABI
(`sdk/bindings/ffi/audioscope_ffi.h`) — the **single FFI seam** every host
binds to (WASM, Rust server, and now Android). The mobile native stack:

```
sdk/bindings/android/
├── CMakeLists.txt          # builds libaudioscope_dsp.so (FetchContent pulls Oboe 1.9.0)
├── exports.version         # linker script (only JNI symbols exported)
├── jni_bridge.cpp          # extern "C" JNI exports → C ABI
└── oboe_capture.cpp        # AudioBinding impl (Oboe AAudio/OpenSL)
```

`libaudioscope_dsp.so` = DSP core + common + C ABI + JNI bridge + Oboe
capture, cross-compiled by the NDK. AGP's `externalNativeBuild` drives the
CMake build from `android/app/build.gradle`.

### JNI export surface

`com.audioscope.dsp.DspModule` (registered via `DspPackage` in
`MainApplication`) exposes:

| JS method | C ABI call |
|-----------|-----------|
| `create()` | `as_fft_new` |
| `destroy(h)` | `as_fft_free` |
| `computeMagnitudes(h, s, rate)` | `as_fft_compute_magnitudes` |
| `measurements(h, s, rate)` | `as_analyze_waveform` |
| `computeSpectrum(h, s, rate, win)` | `as_fft_compute_spectrum` |
| `createBinding()` / `startCapture` / `readSamples` / `stopCapture` | `AudioBinding::*` (Oboe) |

Memory model: malloc'd `asf32_array` buffers are copied into JNI
`jfloatArray`s and freed before returning — the Java side owns a copy, the
C++ side owns nothing across a call (parity with the WASM/Rust hosts).

---

## Project Structure

```
apps/vyzorMobile/
├── app/                            # Expo Router app directory
│   ├── _layout.tsx              # Root layout (SafeArea + QueryClient)
│   ├── index.tsx                # Dashboard screen
│   ├── scope.tsx                # Scope view screen
│   ├── settings.tsx             # Settings screen
│   ├── components/              # UI LAYER
│   │   ├── ui/                 # Button, Card, Text, Input (cva + cn)
│   │   ├── scope/              # mobile-waveform, mobile-grid, mobile-controls
│   │   └── dashboard/          # mobile-stats
│   ├── hooks/                   # PRESENTATION LAYER
│   │   ├── use-mobile-audio.ts
│   │   ├── use-mobile-scope.ts
│   │   ├── use-mobile-settings.ts
│   │   ├── use-media-devices.ts
│   │   └── use-waveform-stream.ts
│   ├── store/                    # STATE LAYER
│   │   ├── scope-store.ts
│   │   ├── settings-store.ts
│   │   └── ui-store.ts
│   └── lib/
│       ├── dsp.ts               # JS wrapper over DspModule
│       ├── utils.ts             # cn() (clsx + tailwind-merge)
│       └── async-storage.ts
├── android/                       # expo prebuild --platform android
│   └── app/src/main/java/com/audioscope/dsp/
│       ├── DspModule.kt        # JNI native module
│       └── DspPackage.kt
├── global.css                     # NativeWind tokens (mirrors web @theme)
├── tailwind.config.ts             # reuses @audio-scope-view/tailwind preset
├── app.json                       # New Arch, RECORD_AUDIO
├── babel.config.js                # NativeWind preset + reanimated
├── metro.config.js                # withNativeWind + workspace watchFolders
└── tsconfig.json
```

---

## Styling — NativeWind + shared Tailwind preset

Mobile does **not** use Tamagui. It uses **NativeWind v4** (Tailwind v3 engine
for RN) so `className="…"` works on RN components, backed by the **same design
tokens** as the web:

- `tailwind.config.ts` imports the `@audio-scope-view/tailwind` preset.
- `global.css` mirrors the web `@theme` block — the same CSS variables
  (`--bg-primary`, `--accent-rose`, `--waveform-cyan`, …) back the preset.
- Components mirror `@audio-scope-view/ui-radix`'s pattern: `cva` for variants,
  `cn()` (clsx + tailwind-merge) for class composition.

---

## Dependency Rules

```
UI LAYER (screens, components)
  └─can use→ PRESENTATION LAYER (hooks)
PRESENTATION LAYER (hooks)
  └─can use→ STORE LAYER (zustand)
  └─can use→ NATIVE DSP LAYER (DspModule / lib/dsp.ts)
  └─can use→ DOMAIN/DATA LAYER (api-client)
STORE LAYER — no dependencies on other layers
DOMAIN/DATA LAYER (packages/api-client) — no dependencies on other layers
```

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React Native 0.76 (New Architecture, Hermes) |
| Build | Expo (prebuilt) + Gradle |
| Routing | Expo Router |
| Styling | NativeWind v4 + `@audio-scope-view/tailwind` preset |
| State | Zustand (local, persisted), TanStack Query (server) |
| Audio Capture | Oboe (AAudio/OpenSL ES) via JNI — **not expo-av** |
| DSP | C++ core (`sdk/dsp`) via C ABI + JNI (`DspModule`) |
| Native Build | NDK CMake (`externalNativeBuild`) → `libaudioscope_dsp.so` |
| Local Persistence | Android Room (SQLite) — `com.audioscope.data` |

---

## Server-optional local mode (impl spec §4 Step 8)

When `persistenceMode === "local"` (Settings → Storage), sessions are written
to the **on-device Android Room SQLite store** first, then synced to the
deployed server when connectivity is available. This is the mobile analog of
the server's own SQLite/Turso store — no IndexedDB, no remote DB round-trip
on the capture path.

```
apps/vyzorMobile/android/app/src/main/java/com/audioscope/data/
├── db/SessionEntity.kt        # Room entity mirroring the server `sessions` schema
│   │                           (rust/migrations 005/009/010/013/014) + serverDirty
├── db/SessionDao.kt           # suspend CRUD (upsert/list/dirty/markClean/delete)
├── db/AudioScopeDatabase.kt   # Room DB singleton (framework SQLite, no native build)
├── LocalSessionRepository.kt  # entity↔DTO mapping; LocalStore singleton accessor
├── SessionDto.kt              # JSON shape returned to JS (mirrors api-client Session)
├── LocalStoreModule.kt        # NativeModule: @ReactMethod async → JSON strings
└── LocalStorePackage.kt       # registered in MainApplication alongside DspPackage
```

The JS side:

```
apps/vyzorMobile/app/
├── lib/local-store.ts            # typed wrapper over AudioScopeLocalStore
├── store/local-session-store.ts  # zustand: sessions[] + syncStatus
├── hooks/use-local-sessions.ts   # CRUD facade (same shape as use-sessions.ts)
└── hooks/use-local-sync.ts       # drains serverDirty rows → Apollo mutations,
                                   marks clean; mounted in _layout (LocalSyncGate)
```

**Data flow:** JS `create()` → `LocalStoreModule.insertSession` →
`LocalSessionRepository.insert` → Room `upsert` (returns immediately, no
network). `useLocalSync` (interval + on-mount) reads `dirty()` rows, pushes
each via `CREATE_NAMED_SESSION`/`UPDATE_SESSION` to the deployed server, then
`markClean(id, serverId)`. Failed pushes stay dirty and retry on the next
tick. The dashboard (`index.tsx`) renders the local list + sync status when
in local mode; otherwise the server-backed hooks are used.

**Build wiring:** `android/build.gradle` adds the KSP Gradle plugin;
`android/app/build.gradle` applies `com.google.devtools.ksp` and adds
`androidx.room:room-runtime/ktx:2.6.1` (+ `room-compiler` via KSP) and
`kotlinx-coroutines-android:1.8.1`. KSP is pinned to `1.9.24-1.0.20` to match
`kotlinVersion` 1.9.24.

---

## Audio Capture (Oboe + JSI)

Capture flows: **Oboe input stream → C++ float32 ring buffer → JNI
`readSamples` → JS Float32Array → scope store → C++ DSP core (FFT +
measurements via `Dsp.computeSpectrum` / `Dsp.measurements`) → store → UI**.
The JS thread never performs an FFT; it only marshalls arrays and renders.

```typescript
// apps/vyzorMobile/app/hooks/use-mobile-audio.ts
const handle = await Dsp.createBinding();        // Oboe AudioBinding
await Dsp.startCapture(handle, "default", 48000); // AAudio stream
const samples = await Dsp.readSamples(handle, 4096); // drain ring
```

---

## Build & Verify

```bash
pnpm prebuild          # expo prebuild --platform android
pnpm build:android     # cd android && ./gradlew assembleDebug
```

`externalNativeBuild` compiles `sdk/bindings/android/` with NDK CMake 3.22.1
into `libaudioscope_dsp.so` for `arm64-v8a`, `armeabi-v7a`, `x86_64`, then
packages it into the APK. `DspModule` loads it via
`System.loadLibrary("audioscope_dsp")`.

---

*Document Version: 2.0*
*Last Updated: 2026-08-11*
