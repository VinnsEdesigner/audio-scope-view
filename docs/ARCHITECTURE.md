# Audio Scope View - Architecture

>
---

## Philosophy

### Core Principles

1. **Single DSP Core** - Write signal processing code once in C++, use everywhere
2. **Native Performance** - No interpreted languages in the DSP path
3. **Clean Separation** - Each layer has one job and does it well
4. **Server Simplicity** - Server is transport + storage, and maybe other functions.

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
    │   │   Receiver  │  │   Service   │  │                    │    │
    │   └─────────────┘  └─────────────┘  └─────────────────────────┘    │
    │                                                                       │
    │                                                                │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## Layer Architecture.

### Layer 1: C++ DSP Core (sdk/dsp/)

**Responsibilities:**
- All signal processing algorithms
- FFT/IFFT computations
- Frequency domain corrections
- Time domain filters
- Audio analysis (THD, SNR, RMS, peak etc,)

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



#### 2. Corrections



#### 3. Measurements



#### 4. Main Processor



### DSP Configuration



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

### Web Audio API Integration


## UI Layer


### WebSocket 

### Messages

## Communication Protocols

### WebSocket Endpoints

```

```

### Authentication

All WebSocket connections require the `Authorization` header (or query param):


**Server → Client (DSP Result):**




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
│   │
│   │
│   └── vyzorMobile/                     # Mobile application (Expo)
│       ├── app/
│                         
│       ├── android/
│       │   └── app/src/main/java/com/ASV/
│       ├── ios/
│       ├── app.json
│       └── ARCHITECTURE.md
│
├── rust/                                 # Server
│   ├── src/
│   │                             
```

---





1. **Real-time WebSocket streaming** - Current API is request/response
2. **C++ DSP Layer** - For native apps with better performance
3. **WASM compilation** - For browser-based DSP
4. **Client implementations** - Platform-specific audio capture

---

*Document Version: 2.1*  
*Last Updated: 2026-07-22*
