export interface StreamingConfig {
  recordingId: string;
  sampleRate: number;
  totalSamples: number;
  chunkSize: number;
  baseUrl: string;
  authHeader?: string;
  /** Samples per DSP block emitted to the renderer (default 1024). */
  dspBlockSize?: number;
  /**
   * Vite-resolved URL of the WASM DSP module factory (audioscope.js). The
   * worklet dynamically imports this URL and instantiates it with `locateFile`
   * pointing at {@link wasmBinaryUrl}. When omitted, the worklet plays audio
   * but emits no per-block DSP frames (graceful degradation).
   */
  wasmModuleUrl?: string;
  /** Vite-resolved URL of the audioscope.wasm binary. */
  wasmBinaryUrl?: string;
}

export interface ChunkRequest {
  type: "request_chunk";
  startSample: number;
  endSample: number;
  priority: number;
}

export interface ChunkData {
  type: "chunk_data";
  startSample: number;
  endSample: number;
  samples: Float32Array | number[];
}

export interface PlayCommand {
  type: "play";
}

export interface PauseCommand {
  type: "pause";
}

export interface StopCommand {
  type: "stop";
}

export interface SeekCommand {
  type: "seek";
  samplePosition: number;
}

export interface SetSpeedCommand {
  type: "set_speed";
  speed: number;
}

export interface ConfigCommand {
  type: "config";
  recordingId: string;
  sampleRate: number;
  totalSamples: number;
  chunkSize: number;
  baseUrl: string;
  authHeader?: string;
  dspBlockSize?: number;
  wasmModuleUrl?: string;
  wasmBinaryUrl?: string;
}

export interface PositionUpdate {
  type: "position_update";
  currentSample: number;
}

export interface BufferStatus {
  type: "buffer_status";
  bufferedChunks: number;
  currentSample: number;
}

export interface ReadyMessage {
  type: "ready";
}

export interface EndedMessage {
  type: "ended";
}

/** WASM DSP core finished loading on the worklet thread; per-block frames will follow. */
export interface DspReadyMessage {
  type: "dsp_ready";
}

/** WASM DSP core failed to load on the worklet thread; playback continues, no frames. */
export interface DspErrorMessage {
  type: "dsp_error";
  message: string;
}

/**
 * Per-block DSP frame computed on the audio thread from the played samples.
 * Mirrors the shape the live-capture dsp-processor posts, so the renderer
 * consumes playback and live frames identically. `magnitudes` is transferred
 * (zero-copy); `analysis` is a plain object.
 */
export interface DspFrameMessage {
  type: "frame";
  magnitudes: Float32Array;
  analysis: {
    peakAmplitude: number;
    negativePeakAmplitude: number;
    rmsAmplitude: number;
    dcOffset: number;
    crestFactor: number;
    zeroCrossingRate: number;
    dominantFrequency: number;
    thd: number;
    snr: number;
  } | null;
  sampleRate: number;
}

export type WorkerOutgoingMessage =
  | ChunkRequest
  | PositionUpdate
  | BufferStatus
  | ReadyMessage
  | EndedMessage
  | DspReadyMessage
  | DspErrorMessage
  | DspFrameMessage;

export type WorkerIncomingMessage =
  | ChunkData
  | PlayCommand
  | PauseCommand
  | StopCommand
  | SeekCommand
  | SetSpeedCommand
  | ConfigCommand;
