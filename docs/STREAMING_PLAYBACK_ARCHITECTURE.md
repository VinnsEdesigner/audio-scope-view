# Audio Scope View - Streaming Playback Architecture

> **Version:** 1.0  
> **Status:** Production  
> **Last Updated:** 2026-08-03

---

## Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Solution Architecture](#solution-architecture)
4. [Server-Side Implementation](#server-side-implementation)
5. [API Client Layer](#api-client-layer)
6. [Web Client Implementation](#web-client-implementation)
7. [AudioWorklet Processor](#audioworklet-processor)
8. [Component Wiring](#component-wiring)
9. [Data Flow Diagrams](#data-flow-diagrams)
10. [Memory Management](#memory-management)
11. [Threshold Configuration](#threshold-configuration)
12. [Alternative Implementations](#alternative-implementations)
13. [File Structure](#file-structure)

---

## Overview

The Audio Scope View application supports playback of large audio recordings (50MB+) through a sophisticated streaming architecture. This document describes how the system handles chunked audio streaming from server to client using the Web Audio API's AudioWorklet interface.

### Key Features

- **True Streaming**: Audio chunks fetched on-demand without loading entire files
- **Zero-Copy Transfers**: Float32Array buffer transfers between main thread and worklet
- **Pre-buffering**: Intelligent chunk preloading ahead of playback position
- **Memory Efficiency**: Old chunks automatically cleaned up to prevent memory bloat
- **Seamless Playback**: Continuous audio generation even during chunk fetches

---

## Problem Statement

Large audio recordings present a significant challenge for web-based playback:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        THE PROBLEM                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Recording Size: 51 MB                                                      │
│  Sample Count: ~11,500,000 samples (at 44.1kHz for ~260 seconds)           │
│  Sample Rate: 44,100 Hz                                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Traditional Approach                               │   │
│  │                                                                       │   │
│  │   1. Fetch entire file (51MB) ──────────────────────────► Memory     │   │
│  │                                                                       │   │
│  │   2. Decode audio                                                     │   │
│  │                                                                       │   │
│  │   3. Create AudioBuffer                                               │   │
│  │                                                                       │   │
│  │   Result: Browser may crash or become unresponsive                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Issues:                                                                    │
│  • 51MB+ of memory allocation                                               │
│  • Long initial loading time                                                │
│  • UI freezes during fetch/decode                                           │
│  • Mobile devices may fail to allocate                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Solution Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     STREAMING PLAYBACK SOLUTION                             │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │                        LARGE RECORDING                                │
    │                      (51MB, ~11.5M samples)                           │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                      SERVER (Rust)                                    │
    │                                                                       │
    │   ┌─────────────────────────────────────────────────────────────┐   │
    │   │  GET /api/recordings/{id}/metadata                           │   │
    │   │  Returns: sample_count, duration_ms, sample_rate             │   │
    │   └─────────────────────────────────────────────────────────────┘   │
    │                                    │                                   │
    │                                    ▼                                   │
    │   ┌─────────────────────────────────────────────────────────────┐   │
    │   │  GET /api/recordings/{id}/stream?start=0&end=44100          │   │
    │   │  Returns: Raw binary f32 samples (~176KB per chunk)          │   │
    │   │                                                             │   │
    │   │  Chunk Size: 44,100 samples (~1 second at 44.1kHz)           │   │
    │   │  Max Chunk: 176,400 samples (~4 seconds max)                 │   │
    │   └─────────────────────────────────────────────────────────────┘   │
    │                                                                       │
    │   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐    │
    │   │  Metadata  │  │   Stream    │  │   Samples (JSON)         │    │
    │   │  Endpoint  │  │   Endpoint  │  │   Endpoint              │    │
    │   └─────────────┘  └─────────────┘  └─────────────────────────┘    │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │       HTTP/REST              │
                    │   (Binary Transfer)          │
                    ▼                               ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                      WEB CLIENT                                       │
    │                                                                       │
    │   ┌─────────────────────────────────────────────────────────────┐   │
    │   │                 useStreamingPlayback Hook                     │   │
    │   │                                                               │   │
    │   │   • Manages AudioContext + AudioWorkletNode                  │   │
    │   │   • Fetches chunks via fetchChunk()                          │   │
    │   │   • Transfers Float32Array to worklet (zero-copy)             │   │
    │   │   • Handles play/pause/stop/seek controls                    │   │
    │   └─────────────────────────────────────────────────────────────┘   │
    │                                    │                                   │
    │                                    ▼                                   │
    │   ┌─────────────────────────────────────────────────────────────┐   │
    │   │            AudioWorkletProcessor (audio-streaming-processor)  │   │
    │   │                                                               │   │
    │   │   • Runs on dedicated audio thread                            │   │
    │   │   • Maintains chunkBuffer Map                                │   │
    │   │   • Preloads 3 chunks ahead                                   │   │
    │   │   • Generates audio in real-time via process()               │   │
    │   └─────────────────────────────────────────────────────────────┘   │
    │                                    │                                   │
    │                                    ▼                                   │
    │   ┌─────────────────────────────────────────────────────────────┐   │
    │   │                   AudioContext.destination                    │   │
    │   │                      (Speakers)                               │   │
    │   └─────────────────────────────────────────────────────────────┘   │
    │                                                                       │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## Server-Side Implementation

### File: `/rust/src/api/handler_recording.rs`

#### REST API Endpoints

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVER ENDPOINTS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GET /api/recordings/{id}/metadata                                          │
│  ─────────────────────────────────                                          │
│  Purpose: Get recording metadata without samples                            │
│                                                                             │
│  Response:                                                                  │
│  {                                                                          │
│    "id": "rec-abc123",                                                      │
│    "name": "Recording 2024-01-15",                                          │
│    "sample_count": 11500000,                                                │
│    "duration_ms": 260771.0,                                                 │
│    "sample_rate": 44100                                                     │
│  }                                                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GET /api/recordings/{id}/stream?start=0&end=44100                         │
│  ─────────────────────────────────────────────────────                      │
│  Purpose: Stream raw PCM audio data for AudioWorklet                         │
│                                                                             │
│  Query Parameters:                                                          │
│    start: Start sample index (default: 0)                                   │
│    end: End sample index (default: 44100, max: 176400)                     │
│                                                                             │
│  Response Headers:                                                          │
│    Content-Type: application/octet-stream                                   │
│    Content-Length: 176400 (bytes)                                           │
│    X-Recording-Id: rec-abc123                                               │
│    X-Start-Sample: 0                                                        │
│    X-End-Sample: 44100                                                      │
│    X-Total-Samples: 11500000                                                │
│    X-Chunk-Size: 44100                                                      │
│                                                                             │
│  Response Body: Raw binary f32 samples (little-endian)                       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GET /api/recordings/{id}/samples?start=0&end=100000                        │
│  ─────────────────────────────────────────────────────                      │
│  Purpose: Get samples as JSON (for API clients)                              │
│                                                                             │
│  Response:                                                                  │
│  {                                                                          │
│    "recording_id": "rec-abc123",                                           │
│    "start": 0,                                                             │
│    "end": 100000,                                                          │
│    "total_samples": 11500000,                                               │
│    "samples": [0.123, -0.456, 0.789, ...]  // f32 array                    │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Chunk Size Configuration

```rust
// For PCM streaming endpoint (used by AudioWorklet)
const DEFAULT_CHUNK_SIZE: usize = 44_100;   // ~1 second at 44.1kHz (~176KB)
const MAX_CHUNK_SIZE: usize = 176_400;      // ~4 seconds max (~706KB)

// For JSON samples endpoint (used by API clients)
const DEFAULT_CHUNK_SIZE: usize = 100_000; // ~400KB
const MAX_CHUNK_SIZE: usize = 500_000;      // ~2MB max
```

#### Route Registration

```rust
// File: /rust/src/api/server_graphql.rs

let recordings_router = Router::new()
    .route("/api/recordings/{id}/samples", get(get_recording_samples))
    .route("/api/recordings/{id}/stream", get(stream_recording_pcm))
    .route("/api/recordings/{id}/metadata", get(get_recording_metadata))
    .with_state(state.clone());
```

---

## API Client Layer

### File: `/packages/api-client/src/domain/recording/sample-chunk-service.ts`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SampleChunkService                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Class: SampleChunkService                                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Constants                                                             │   │
│  │                                                                       │   │
│  │   DEFAULT_CHUNK_SIZE = 100_000  // ~400KB per request                 │   │
│  │   MAX_CHUNK_SIZE = 500_000      // ~2MB max per request               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Methods                                                              │   │
│  │                                                                       │   │
│  │   getMetadata(recordingId)                                            │   │
│  │   ─────────────────────────────────                                  │   │
│  │   Returns: RecordingMetadata                                          │   │
│  │   • id, name, sample_count, duration_ms, sample_rate                  │   │
│  │                                                                       │   │
│  │   getSamples(recordingId, start, end)                                 │   │
│  │   ─────────────────────────────────────────                           │   │
│  │   Returns: SampleChunkResponse                                        │   │
│  │   • recording_id, start, end, total_samples, samples[]                │   │
│  │                                                                       │   │
│  │   *streamChunks(recordingId, chunkSize)                              │   │
│  │   ─────────────────────────────────────────                           │   │
│  │   AsyncGenerator yielding SampleChunkResponse                         │   │
│  │   • Automatically pages through all chunks                            │   │
│  │                                                                       │   │
│  │   loadSamplesForTimeRange(recordingId, startMs, endMs)                │   │
│  │   ───────────────────────────────────────────────                     │   │
│  │   Returns samples for a specific time window                          │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Usage Example

```typescript
import { SampleChunkService, sampleChunkService } from "@audio-scope-view/api-client";

// Direct usage
const service = new SampleChunkService();

// Get metadata first
const meta = await service.getMetadata("rec-abc123");
console.log(`Duration: ${meta.duration_ms}ms, Samples: ${meta.sample_count}`);

// Stream chunks
for await (const chunk of service.streamChunks("rec-abc123", 100_000)) {
  console.log(`Got chunk: ${chunk.start} - ${chunk.end}`);
  // Process chunk...
}
```

---

## Web Client Implementation

### File: `/apps/vyzorWeb/src/audio/use-streaming-playback.ts`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      useStreamingPlayback Hook                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Purpose: Main hook for AudioWorklet-based streaming playback               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  State (StreamingPlaybackState)                                     │   │
│  │                                                                       │   │
│  │   isLoading: boolean           // Fetching metadata                 │   │
│  │   isPlaying: boolean           // Currently playing                 │   │
│  │   isReady: boolean             // Worklet initialized               │   │
│  │   currentTime: number          // Current time (ms)                 │   │
│  │   duration: number             // Total duration (ms)              │   │
│  │   currentSample: number         // Current sample index              │   │
│  │   totalSamples: number         // Total samples in recording       │   │
│  │   bufferedChunks: number       // Chunks in memory                 │   │
│  │   isBuffering: boolean         // Waiting for chunks                │   │
│  │   error: Error | undefined     // Any errors                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Options (StreamingPlaybackOptions)                                 │   │
│  │                                                                       │   │
│  │   recordingId: string            // Recording to play                │   │
│  │   chunkSize?: number             // Samples per chunk (default: 44100) │ │
│  │   playbackSpeed?: number         // Speed multiplier (default: 1)   │   │
│  │   autoPlay?: boolean             // Start immediately (default: false) │ │
│  │   onEnded?: () => void           // Callback when playback ends      │ │
│  │   onError?: (e: Error) => void   // Error callback                   │ │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Controls                                                             │   │
│  │                                                                       │   │
│  │   play()              // Start/resume playback                       │   │
│  │   pause()              // Pause playback                             │   │
│  │   stop()               // Stop and reset to beginning                 │   │
│  │   seek(timeMs)         // Seek to position                           │   │
│  │   setSpeed(speed)      // Change playback speed                       │   │
│  │                                                                       │   │
│  │   getCurrentSampleIndex(): number                                    │   │
│  │   getCurrentTimeMs(): number                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Hook Initialization Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HOOK INITIALIZATION SEQUENCE                              │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  useEffect #1: Load Metadata                                         │
    │                                                                       │
    │   ┌─────────────────────────────────────────────────────────────┐   │
    │   │  fetch(/api/recordings/{id}/metadata)                        │   │
    │   │                                                             │   │
    │   │  Sets: totalSamples, sampleRate, durationMs                   │   │
    │   └─────────────────────────────────────────────────────────────┘   │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  useEffect #2: Initialize Audio                                     │
    │                                                                       │
    │   ┌─────────────────────────────────────────────────────────────┐   │
    │   │  1. Create AudioContext({ sampleRate })                     │   │
    │   │                                                             │   │
    │   │  2. Load AudioWorklet processor:                             │   │
    │   │     await context.audioWorklet.addModule(                    │   │
    │   │       "/audio/worklets/audio-streaming-processor.js"         │   │
    │   │                                                             │   │
    │   │  3. Create AudioWorkletNode:                                 │   │
    │   │     new AudioWorkletNode(context,                            │   │
    │   │       "audio-streaming-processor",                          │   │
    │   │       { numberOfInputs: 0, numberOfOutputs: 1 })            │   │
    │   │                                                             │   │
    │   │  4. Connect to destination:                                  │   │
    │   │     workletNode.connect(context.destination)                 │   │
    │   │                                                             │   │
    │   │  5. Configure worklet via postMessage:                       │   │
    │   │     { type: "config", recordingId, sampleRate,               │   │
    │   │       totalSamples, chunkSize, baseUrl }                    │   │
    │   └─────────────────────────────────────────────────────────────┘   │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  State Updated: isReady = true                                     │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## AudioWorklet Processor

### File: `/apps/vyzorWeb/src/audio/worklets/audio-streaming-processor.js`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  AudioStreamingProcessor (AudioWorklet)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Class: AudioStreamingProcessor extends AudioWorkletProcessor                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Internal State                                                       │   │
│  │                                                                       │   │
│  │   config: Object | null         // Configuration from main thread    │   │
│  │   isPlaying: boolean            // Playback state                   │   │
│  │   currentSample: number          // Current playback position        │   │
│  │   playbackSpeed: number          // Speed multiplier (1.0 = normal)  │   │
│  │                                                                       │   │
│  │   chunkBuffer: Map<string, Float32Array>  // Cached chunks          │   │
│  │   pendingRequests: Set<string>    // In-flight chunk requests        │   │
│  │                                                                       │   │
│  │   preloadAhead: 3                // Number of chunks to preload     │   │
│  │   bufferAheadSeconds: 0.2        // Seconds to buffer ahead         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Message Handlers (port.onmessage)                                 │   │
│  │                                                                       │   │
│  │   'config'       → Store configuration                             │   │
│  │   'play'          → Set isPlaying = true, trigger preload            │   │
│  │   'pause'         → Set isPlaying = false                           │   │
│  │   'stop'          → Reset position, clear buffers                   │   │
│  │   'seek'          → Jump to position, clear old chunks               │   │
│  │   'set_speed'     → Update playbackSpeed                             │   │
│  │   'chunk_data'    → Store received chunk in chunkBuffer             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  process(inputs, outputs) → boolean                                  │   │
│  │                                                                       │   │
│  │  Called by Web Audio API at sample rate (e.g., 44100 Hz)            │   │
│  │  Must return quickly - runs on dedicated audio thread                │   │
│  │                                                                       │   │
│  │  For each output sample [i]:                                         │   │
│  │    1. Calculate sampleIndex = currentSample + (i * playbackSpeed)    │   │
│  │    2. Find chunk containing sampleIndex                               │   │
│  │    3. If chunk available → output[i] = chunk[offset]                 │   │
│  │    4. If chunk missing → output[i] = 0, request chunk               │   │
│  │    5. Advance currentSample += playbackSpeed                         │   │
│  │    6. Periodically: report position, preload ahead                   │   │
│  │                                                                       │   │
│  │  Returns: true (keep processor alive)                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Chunk Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CHUNK BUFFER MANAGEMENT                               │
└─────────────────────────────────────────────────────────────────────────────┘

    Chunk Key Format: startSample (as string)
    
    Example chunks for a recording with chunkSize = 44100:
    
    ┌─────────────────────────────────────────────────────────────────────┐
    │                        Recording Timeline                            │
    └─────────────────────────────────────────────────────────────────────┘
    
    0           44100       88200      132300     176400     220500
    │───────────│───────────│───────────│───────────│───────────│
    Chunk 0     Chunk 1     Chunk 2     Chunk 3     Chunk 4     ...
    
    ┌─────────────────────────────────────────────────────────────────────┐
    │  chunkBuffer Map (when playing at sample ~100000):                    │
    │                                                                       │
    │   "0"       → Float32Array(44100)   ✓ (behind playback)            │
    │   "44100"   → Float32Array(44100)   ✓ (current chunk)              │
    │   "88200"   → Float32Array(44100)   ✓ (preloaded)                  │
    │   "132300"  → Float32Array(44100)   ✓ (preloaded)                  │
    │   "176400"  → Float32Array(44100)   ○ (requested but not received) │
    │                                                                       │
    │  pendingRequests Set: "176400"                                        │
    │                                                                       │
    └─────────────────────────────────────────────────────────────────────┘
    
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Cleanup Logic (preloadChunks called when crossing chunk boundary):  │
    │                                                                       │
    │   minChunkKey = (currentChunk - 2) * chunkSize                       │
    │                                                                       │
    │   For each chunkKey in chunkBuffer:                                  │
    │     if (parseInt(chunkKey) < minChunkKey):                          │
    │       delete chunkBuffer[chunkKey]  // Remove old chunks             │
    │                                                                       │
    │   This keeps chunks 2 positions behind playback for seek-back        │
    └─────────────────────────────────────────────────────────────────────┘
```

### Preload Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRELOAD STRATEGY                                     │
└─────────────────────────────────────────────────────────────────────────────┘

    When playback starts or crosses a chunk boundary:
    
    ┌─────────────────────────────────────────────────────────────────────┐
    │  preloadAhead = 3 chunks                                            │
    │  bufferAheadSeconds = 0.2 seconds                                   │
    │                                                                       │
    │  Current position: sample 50,000, chunkSize = 44100                  │
    │  Sample rate: 44,100 Hz                                             │
    │                                                                       │
    │  Calculate chunks to preload:                                        │
    │    currentChunk = floor(50000 / 44100) = 1                          │
    │    aheadChunks = ceil((0.2 * 44100) / 44100) + 3 = 1 + 3 = 4        │
    │                                                                       │
    │  Request chunks:                                                     │
    │    Chunk 1 (current)    → already loaded                             │
    │    Chunk 2 (+1)        → request                                     │
    │    Chunk 3 (+2)        → request                                     │
    │    Chunk 4 (+3)        → request                                     │
    │    Chunk 5 (+4)        → request                                     │
    └─────────────────────────────────────────────────────────────────────┘
    
    This ensures 3-4 seconds of audio is buffered ahead of playback.
```

---

## Component Wiring

### File: `/apps/vyzorWeb/src/routes/scope-page.tsx`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SCOPE PAGE COMPONENT WIRING                             │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  Threshold Decision                                                  │
    │                                                                       │
    │   STREAMING_THRESHOLD_SAMPLES = 500_000  // ~10 sec or ~11MB        │
    │   STREAMING_THRESHOLD_BYTES = 5 * 1024 * 1024  // 5MB               │
    │                                                                       │
    │   shouldUseStreaming =                                               │
    │     recording.sampleCount > 500_000 ||                                │
    │     recording.sizeBytes > 5_000_000                                   │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Hook Initialization                                                  │
    │                                                                       │
    │   const streamingPlayback = useStreamingPlayback({                    │
    │     recordingId: recordingId ?? "",                                    │
    │     chunkSize: 44100,  // ~1 second per chunk                        │
    │     autoPlay: false,                                                  │
    │     onEnded: () => {                                                  │
    │       if (loopPlayback) {                                             │
    │         streamingPlayback.seek(0);                                    │
    │         streamingPlayback.play();                                      │
    │       }                                                               │
    │     },                                                                │
    │   });                                                                 │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Control Handlers                                                     │
    │                                                                       │
    │   const handlePlay = () => {                                          │
    │     if (shouldUseStreaming) {                                         │
    │       streamingPlayback.play();                                       │
    │     }                                                                │
    │     setIsPlaying(true);                                               │
    │   };                                                                  │
    │                                                                       │
    │   const handlePause = () => {                                        │
    │     if (shouldUseStreaming) {                                        │
    │       streamingPlayback.pause();                                      │
    │     }                                                                │
    │     setIsPlaying(false);                                              │
    │   };                                                                  │
    │                                                                       │
    │   const handleStop = () => {                                         │
    │     if (shouldUseStreaming) {                                         │
    │       streamingPlayback.stop();                                       │
    │     }                                                                │
    │     setIsPlaying(false);                                              │
    │     setCurrentPlaybackTime(0);                                        │
    │   };                                                                  │
    │                                                                       │
    │   const handleSeek = (time: number) => {                             │
    │     if (shouldUseStreaming) {                                         │
    │       streamingPlayback.seek(time);                                  │
    │     }                                                                │
    │     setCurrentPlaybackTime(time);                                     │
    │   };                                                                  │
    │                                                                       │
    │   const handleSpeedChange = (speed: number) => {                     │
    │     setPlaybackSpeed(speed);                                          │
    │     if (shouldUseStreaming) {                                         │
    │       streamingPlayback.setSpeed(speed);                              │
    │     }                                                                │
    │   };                                                                  │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Time Sync (useEffect animation loop)                                │
    │                                                                       │
    │   useEffect(() => {                                                  │
    │     if (shouldUseStreaming && streamingPlayback.state.isPlaying) {   │
    │       setCurrentPlaybackTime(streamingPlayback.state.currentTime);   │
    │     }                                                                │
    │   }, [shouldUseStreaming, streamingPlayback.state.isPlaying,         │
    │        streamingPlayback.state.currentTime]);                         │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Component Props                                                      │
    │                                                                       │
    │   <ScopeTopBar                                                        │
    │     isPlaying={isPlaying}                                             │
    │     onPlay={handlePlay}                                               │
    │     onPause={handlePause}                                             │
    │     onStop={handleStop}                                               │
    │   />                                                                   │
    │                                                                       │
    │   <ScopeBottomControls                                                │
    │     isPlaying={isPlaying}                                              │
    │     currentTime={currentPlaybackTime}                                 │
    │     duration={recordingData?.durationMs}                              │
    │     onPlay={handlePlay}                                               │
    │     onPause={handlePause}                                             │
    │     onStop={handleStop}                                               │
    │     onSeek={handleSeek}                                               │
    │     playbackSpeed={playbackSpeed}                                      │
    │     onSpeedChange={handleSpeedChange}                                 │
    │     loopPlayback={loopPlayback}                                       │
    │     onLoopToggle={handleLoopToggle}                                   │
    │   />                                                                   │
    │                                                                       │
    │   <ScopeCanvas                                                         │
    │     waveformData={waveformData}  // Uses waveformOverview            │
    │     isCapturing={isCapturing}                                         │
    │   />                                                                   │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMPLETE DATA FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  1. PAGE LOAD - Recording Playback Request                          │
    │                                                                       │
    │   User navigates to: /scope?recording=rec-abc123                     │
    │                                                                       │
    │   scope-page.tsx                                                     │
    │       │                                                               │
    │       ▼                                                               │
    │   useRecording("rec-abc123")                                         │
    │       │                                                               │
    │       ▼                                                               │
    │   GraphQL: recordingPreview(id: "rec-abc123")                        │
    │       │                                                               │
    │       ▼                                                               │
    │   {                                                                   │
    │     id: "rec-abc123",                                                │
    │     name: "Recording 2024-01-15",                                     │
    │     sampleCount: 11500000,     // 51MB worth                          │
    │     sizeBytes: 46000000,                                                │
    │     durationMs: 260771,                                                │
    │     waveformOverview: [...],   // For visualization                   │
    │   }                                                                   │
    │       │                                                               │
    │       ▼                                                               │
    │   shouldUseStreaming = true  // 11500000 > 500000                     │
    └─────────────────────────────────────────────────────────────────────┘

                                    │ shouldUseStreaming = true
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  2. INITIALIZE STREAMING PLAYBACK                                    │
    │                                                                       │
    │   useStreamingPlayback({                                             │
    │     recordingId: "rec-abc123",                                        │
    │     chunkSize: 44100,                                                 │
    │   })                                                                  │
    │       │                                                               │
    │       ├──► Fetch metadata                                             │
    │       │       GET /api/recordings/rec-abc123/metadata                │
    │       │                                                               │
    │       ├──► Create AudioContext                                       │
    │       │       AudioContext({ sampleRate: 44100 })                    │
    │       │                                                               │
    │       ├──► Load AudioWorklet                                          │
    │       │       await context.audioWorklet.addModule(                   │
    │       │         "/audio/worklets/audio-streaming-processor.js"        │
    │       │       )                                                       │
    │       │                                                               │
    │       └──► Create AudioWorkletNode                                   │
    │               new AudioWorkletNode(context,                           │
    │                 "audio-streaming-processor",                          │
    │                 { numberOfInputs: 0, numberOfOutputs: 1 }             │
    │               )                                                       │
    │               .connect(context.destination)                           │
    └─────────────────────────────────────────────────────────────────────┘

                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  3. USER CLICKS PLAY                                                │
    │                                                                       │
    │   handlePlay() called                                                │
    │       │                                                               │
    │       ▼                                                               │
    │   streamingPlayback.play()                                           │
    │       │                                                               │
    │       ▼                                                               │
    │   workletNode.port.postMessage({ type: "play" })                     │
    │       │                                                               │
    │       ▼                                                               │
    │   AudioStreamingProcessor.preloadChunks()                            │
    │       │                                                               │
    │       ▼                                                               │
    │   AudioWorklet requests chunk 0:                                      │
    │       │                                                               │
    │       ▼                                                               │
    │   port.postMessage({                                                 │
    │     type: "request_chunk",                                           │
    │     startSample: 0,                                                  │
    │     endSample: 44100,                                                │
    │   })                                                                  │
    └─────────────────────────────────────────────────────────────────────┘

                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  4. CHUNK FETCHING (Main Thread)                                    │
    │                                                                       │
    │   handleWorkletMessage({ type: "request_chunk", startSample: 0 })    │
    │       │                                                               │
    │       ▼                                                               │
    │   fetchChunk(0, 44100)                                               │
    │       │                                                               │
    │       ▼                                                               │
    │   GET /api/recordings/rec-abc123/stream?start=0&end=44100            │
    │       │                                                               │
    │       ▼                                                               │
    │   Response: 176400 bytes of raw f32 (binary)                         │
    │       │                                                               │
    │       ▼                                                               │
    │   Convert to Float32Array:                                           │
    │       │                                                               │
    │       ▼                                                               │
    │   workletNode.port.postMessage(                                      │
    │     { type: "chunk_data", startSample: 0, samples: Float32Array },   │
    │     [samples.buffer]  // Transfer ownership                           │
    │   )                                                                   │
    │       │                                                               │
    │       ▼                                                               │
    │   AudioStreamingProcessor.chunkBuffer.set("0", samples)              │
    │       │                                                               │
    │       ▼                                                               │
    │   Port: { type: "buffer_status", bufferedChunks: 1 }                 │
    └─────────────────────────────────────────────────────────────────────┘

                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  5. REAL-TIME AUDIO GENERATION (Audio Thread)                       │
    │                                                                       │
    │   process(inputs, outputs) called ~44,100 times/second               │
    │                                                                       │
    │   For each sample [i]:                                              │
    │     │                                                               │
    │     ├──► Calculate position:                                         │
    │     │       sampleIndex = currentSample + (i * playbackSpeed)        │
    │     │                                                               │
    │     ├──► Find chunk:                                                 │
    │     │       chunkKey = floor(sampleIndex / 44100) * 44100            │
    │     │                                                               │
    │     ├──► Get sample from chunk:                                      │
    │     │       if (chunkBuffer.has(chunkKey))                           │
    │     │         output[i] = chunk[offsetInChunk]                       │
    │     │       else                                                     │
    │     │         output[i] = 0  // Silence, request chunk               │
    │     │                                                               │
    │     └──► Advance position:                                           │
    │             currentSample += playbackSpeed                           │
    │                                                                       │
    │   Every 2048 samples:                                                │
    │     port.postMessage({ type: "position_update", currentSample })    │
    └─────────────────────────────────────────────────────────────────────┘

                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  6. UI TIME SYNC                                                     │
    │                                                                       │
    │   Main thread receives position_update every ~46ms                   │
    │       │                                                               │
    │       ▼                                                               │
    │   streamingPlayback.state.currentTime updated                        │
    │       │                                                               │
    │       ▼                                                               │
    │   useEffect triggers:                                                 │
    │       │                                                               │
    │       ▼                                                               │
    │   setCurrentPlaybackTime(streamingPlayback.state.currentTime)       │
    │       │                                                               │
    │       ▼                                                               │
    │   BottomControls re-render with new time                            │
    │   Seek bar thumb position updated                                    │
    └─────────────────────────────────────────────────────────────────────┘
```

### Visualization vs Playback Separation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              VISUALIZATION VS PLAYBACK - SEPARATION                         │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │                           RECORDING                                    │
    │                                                                       │
    │   Total Samples: 11,500,000 (51MB)                                    │
    │   waveformOverview: ~8,000 points (min-max pairs)                     │
    │                                                                       │
    └─────────────────────────────────────────────────────────────────────┘
                    │                           │
                    ▼                           ▼
    ┌────────────────────────────────┐  ┌────────────────────────────────┐
    │        VISUALIZATION            │  │          PLAYBACK               │
    ├────────────────────────────────┤  ├────────────────────────────────┤
    │                                │  │                                │
    │   Data: waveformOverview       │  │   Data: Actual PCM chunks      │
    │   Size: ~8KB                   │  │   Size: ~176KB per chunk       │
    │                                │  │                                │
    │   Purpose: Fast display of     │  │   Purpose: Audio output to    │
    │   waveform shape               │  │   speakers                     │
    │                                │  │                                │
    │   Source: Pre-computed on      │  │   Source: Fetched on-demand    │
    │   server during recording      │  │   from /stream endpoint        │
    │                                │  │                                │
    │   Loading: With recording      │  │   Loading: Progressive via     │
    │   metadata (single request)    │  │   AudioWorklet                 │
    │                                │  │                                │
    │   Used by: ScopeCanvas         │  │   Used by: AudioContext →     │
    │                                │  │   Speakers                     │
    │                                │  │                                │
    │   Rate: Updates only on        │  │   Rate: 44,100 samples/second │
    │   seek/playhead change        │  │   (real-time)                  │
    │                                │  │                                │
    └────────────────────────────────┘  └────────────────────────────────┘
```

---

## Memory Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MEMORY MANAGEMENT                                    │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  Memory Per Chunk (Float32Array)                                     │
    │                                                                       │
    │   44,100 samples × 4 bytes/sample = 176,400 bytes ≈ 172 KB         │
    │                                                                       │
    │   With 3 preload + 1 current = 4 chunks in memory                    │
    │   Total: 4 × 172 KB = 688 KB ≈ 0.7 MB                              │
    │                                                                       │
    │   Compare to loading entire recording:                               │
    │   11,500,000 samples × 4 bytes = 46,000,000 bytes ≈ 44 MB          │
    │                                                                       │
    │   Savings: 44 MB → 0.7 MB = 98.4% reduction                         │
    └─────────────────────────────────────────────────────────────────────┘
    
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Chunk Lifecycle                                                     │
    │                                                                       │
    │   1. REQUESTED → Added to pendingRequests Set                        │
    │         │                                                             │
    │         ▼                                                             │
    │   2. RECEIVED → Moved to chunkBuffer Map, removed from pending       │
    │         │                                                             │
    │         ▼                                                             │
    │   3. PLAYED (behind by 2+ chunks) → Deleted from Map                 │
    │                                                                       │
    │   During normal playback, chunks flow:                                │
    │                                                                       │
    │   ┌─────────────────────────────────────────────────────────────┐    │
    │   │                                                              │    │
    │   │   pending ──► chunkBuffer ──► deleted                        │    │
    │   │      │              │               │                        │    │
    │   │      ▼              ▼               ▼                        │    │
    │   │   requesting     in-memory      garbage collected           │    │
    │   │                                                              │    │
    │   └─────────────────────────────────────────────────────────────┘    │
    └─────────────────────────────────────────────────────────────────────┘
    
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Transfer vs Copy (Zero-Copy Optimization)                           │
    │                                                                       │
    │   Regular postMessage (copies data):                                 │
    │     worklet.postMessage({ samples: float32Array })                  │
    │     // Data is cloned - 2x memory                                    │
    │                                                                       │
    │   Transfer postMessage (moves data):                                 │
    │     worklet.postMessage({ samples: float32Array },                  │
    │                         [float32Array.buffer])                     │
    │     // Ownership transferred, main thread no longer owns buffer      │
    │     // Audio thread uses the buffer directly                         │
    │     // Main thread must NOT use samples after this!                  │
    │                                                                       │
    │   Memory timeline:                                                   │
    │                                                                       │
    │   Before transfer:                                                   │
    │     Main thread: [samples Float32Array - 172KB]                      │
    │     Audio thread: (nothing)                                          │
    │                                                                       │
    │   After transfer:                                                    │
    │     Main thread: (nothing - samples no longer accessible)            │
    │     Audio thread: [samples Float32Array - 172KB]                    │
    │                                                                       │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## Threshold Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THRESHOLD CONFIGURATION                               │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  Decision Criteria (scope-page.tsx)                                 │
    │                                                                       │
    │   const STREAMING_THRESHOLD_SAMPLES = 500_000;                      │
    │   const STREAMING_THRESHOLD_BYTES = 5 * 1024 * 1024; // 5MB          │
    │                                                                       │
    │   const shouldUseStreaming =                                         │
    │     recordingData.sampleCount > STREAMING_THRESHOLD_SAMPLES ||       │
    │     recordingData.sizeBytes > STREAMING_THRESHOLD_BYTES;             │
    └─────────────────────────────────────────────────────────────────────┘
    
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Threshold Rationale                                                 │
    │                                                                       │
    │   Sample threshold (500,000):                                        │
    │     - At 44.1kHz: ~11.3 seconds of audio                            │
    │     - At 48kHz: ~10.4 seconds of audio                              │
    │     - Byte size: ~2MB for 500,000 samples (32-bit float)             │
    │                                                                       │
    │   Byte threshold (5MB):                                               │
    │     - Provides safety margin regardless of sample count              │
    │     - Some recordings may have metadata but large samples             │
    │                                                                       │
    │   Use streaming when EITHER threshold exceeded                       │
    └─────────────────────────────────────────────────────────────────────┘
    
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Size Comparisons                                                    │
    │                                                                       │
    │   ┌──────────────────────────────────────────────────────────────┐   │
    │   │  Duration at 44.1kHz vs Threshold                            │   │
    │   ├──────────────────────────────────────────────────────────────┤   │
    │   │                                                              │   │
    │   │  500,000 samples = 11.3 seconds  ────► Use Streaming         │   │
    │   │                                                              │   │
    │   │  100,000 samples = 2.3 seconds   ────► Use Chunked/Fallback  │   │
    │   │                                                              │   │
    │   │  11,500,000 samples = 4.3 minutes ────► Use Streaming       │   │
    │   │                                                              │   │
    │   └──────────────────────────────────────────────────────────────┘   │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## Alternative Implementations

### useChunkedPlayback Hook

**File:** `/apps/vyzorWeb/src/hooks/use-chunked-playback.ts`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    useChunkedPlayback - Overview                             │
└─────────────────────────────────────────────────────────────────────────────┘

    Purpose: Alternative playback using AudioBufferSourceNode
    
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Architecture                                                        │
    │                                                                       │
    │   ┌─────────────────────────────────────────────────────────────┐   │
    │   │  1. Load chunks via SampleChunkService                       │   │
    │   │                                                             │   │
    │   │  2. Build AudioBuffer from loaded chunks                    │   │
    │   │                                                             │   │
    │   │  3. Create AudioBufferSourceNode                           │   │
    │   │                                                             │   │
    │   │  4. Connect: source → destination                           │   │
    │   │                                                             │   │
    │   │  5. source.start(0, offset)                                │   │
    │   └─────────────────────────────────────────────────────────────┘   │
    │                                                                       │
    │  Key Differences from AudioWorklet:                                   │
    │                                                                       │
    │   ┌──────────────────────┬─────────────────────────────────────┐     │
    │   │  Aspect             │  AudioWorklet      │  AudioBuffer   │     │
    │   ├──────────────────────┼─────────────────────────────────────┤     │
    │   │  Memory (51MB rec)  │  ~0.7 MB          │  ~51 MB        │     │
    │   │  Seek latency       │  Low (streaming)  │  High (reload) │     │
    │   │  Implementation     │  Complex          │  Simple        │     │
    │   │  Flexibility        │  High             │  Limited       │     │
    │   │  Use case           │  Large files      │  Small files   │     │
    │   └──────────────────────┴─────────────────────────────────────┘     │
    │                                                                       │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
audio-scope-view/
├── docs/
│   ├── ARCHITECTURE.md                              # System architecture
│   ├── STREAMING_PLAYBACK_ARCHITECTURE.md          # This document
│   ├── scope-page-architecture.md                   # UI component architecture
│   └── ARCHITECTURE_SESSION_RESTRUCTURING.md        # Session changes
│
├── rust/
│   └── src/
│       ├── api/
│       │   ├── handler_recording.rs                # REST endpoints
│       │   │   ├── get_recording_samples()         # JSON samples
│       │   │   ├── stream_recording_pcm()          # Binary streaming
│       │   │   └── get_recording_metadata()        # Metadata
│       │   └── server_graphql.rs                   # Route registration
│       │
│       └── application/
│           └── service_recording.rs                # Recording service
│
├── packages/
│   └── api-client/
│       └── src/
│           └── domain/
│               └── recording/
│                   └── sample-chunk-service.ts      # Chunk client
│
└── apps/
    └── vyzorWeb/
        └── src/
            ├── audio/                              # AudioWorklet
            │   ├── index.ts                        # Exports
            │   ├── use-streaming-playback.ts       # Main hook
            │   └── worklets/
            │       ├── audio-streaming-processor.js       # Worklet
            │       └── audio-streaming-processor.d.ts     # Types
            │
            ├── hooks/
            │   ├── index.ts                         # Exports
            │   ├── use-recordings.ts               # GraphQL queries
            │   └── use-chunked-playback.ts         # Alternative
            │
            ├── routes/
            │   └── scope-page.tsx                  # Main page wiring
            │
            └── components/
                └── scope/
                    ├── scope-bottom-controls.tsx   # Playback controls
                    └── scope-top-bar.tsx           # Play/pause buttons
```

---

## API Reference

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/recordings/{id}/metadata` | GET | Get recording metadata |
| `/api/recordings/{id}/samples` | GET | Get samples as JSON |
| `/api/recordings/{id}/stream` | GET | Stream raw PCM binary |

### GraphQL Queries

| Query | Description |
|-------|-------------|
| `recordingPreview(id)` | Get recording with metadata, waveformOverview |
| `recording(id)` | Get full recording with samples |

### Hook API

| Function | Description |
|----------|-------------|
| `useStreamingPlayback(options)` | AudioWorklet-based streaming |
| `useChunkedPlayback(options)` | AudioBuffer-based playback |
| `useRecording(id)` | GraphQL recording query |

---

## Troubleshooting

### Common Issues

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TROUBLESHOOTING GUIDE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    Issue: Playback stutters or has gaps
    ─────────────────────────────────────
    Possible causes:
      • Network latency between chunks
      • Chunk size too small
      • preloadAhead too low
    
    Solutions:
      • Increase chunkSize to 88200 or 176400
      • Increase preloadAhead in worklet
      • Check network connection
    
    ──────────────────────────────────────────────────────────────────────────
    
    Issue: AudioWorklet fails to load
    ─────────────────────────────────────
    Possible causes:
      • Worklet file not in public directory
      • Incorrect path in addModule()
      • CORS issues
    
    Solutions:
      • Verify file exists at /audio/worklets/audio-streaming-processor.js
      • Check workletPath in use-streaming-playback.ts
      • Ensure server serves from public/ directory
    
    ──────────────────────────────────────────────────────────────────────────
    
    Issue: Memory usage grows unbounded
    ─────────────────────────────────────
    Possible causes:
      • Chunk cleanup not working
      • pendingRequests growing
      • Float32Array not transferred
    
    Solutions:
      • Check cleanup logic in preloadChunks()
      • Ensure chunkBuffer.delete() is called
      • Use [samples.buffer] transfer in postMessage
    
    ──────────────────────────────────────────────────────────────────────────
    
    Issue: Seek has latency
    ─────────────────────────────────────
    Possible causes:
      • No chunks preloaded around seek position
      • Fetch takes time to complete
    
    Solutions:
      • Preload chunks around seek position
      • Show buffering indicator during fetch
      • Consider larger preloadAhead

```

---

*Document Version: 1.0*  
*Last Updated: 2026-08-03*
