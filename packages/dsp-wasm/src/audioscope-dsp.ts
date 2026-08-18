// audioscope-dsp.ts — TypeScript wrapper over the WebAssembly DSP module.
//
// This is the browser/worklet analog of rust/src/infrastructure/dsp_ffi.rs:
// it loads the WASM module produced by sdk/wasm/ (audioscope.js +
// audioscope.wasm in ../dist/) and exposes typed methods that allocate into
// the WASM heap, call the KEEPALIVE C ABI, copy results out, and free. No DSP
// algorithm is reimplemented here — the C++ core is the single source of truth.
//
// Memory model (mirrors the Rust FFI):
//   • Array-returning ops return a malloc'd data pointer + length. The wrapper
//     copies the data into a fresh typed array, then calls em_free(ptr).
//   • Composite-struct ops (spectrum, harmonics, spectrogram, waveform
//     analysis, compressed waveform) return a malloc'd struct pointer. The
//     wrapper reads fields at fixed offsets (see the OFFSET_* constants),
//     follows inner pointers, copies, then calls the composite's em_*_free
//     (which frees the inner arrays) followed by em_free(ptr) for the holder.
//
// All offsets are for wasm32 (4-byte pointers, 4-byte size_t) with natural
// alignment. They match the struct definitions in audioscope_ffi.h exactly.

import type {
  CompressedWaveform,
  FrequencyComponent,
  HarmonicAnalysis,
  GeneratorKind,
  NoiseType,
  SpectrogramConfig,
  SpectrogramData,
  Spectrum,
  TriggerEdge,
  TriggerOptions,
  TriggerResult,
  WaveformAnalysis,
  WindowType,
} from "./types";

// WASM module factory shape (the MODULARIZE=1 + EXPORT_ES6=1 output).
type DspModuleFactory = () => Promise<DspModule>;

interface DspModule {
  // Heap views + alloc/free (EXPORTED_RUNTIME_METHODS + EXPORTED_FUNCTIONS).
  HEAPF32: Float32Array;
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
  _malloc(n: number): number;
  _free(ptr: number): void;
  getValue(ptr: number, type: string): number;
  setValue(ptr: number, value: number, type: string): void;
  // KEEPALIVE exports.
  _em_free(ptr: number): void;
  _em_alloc(n: number): number;
  _em_fft_new(): number;
  _em_fft_free(handle: number): void;
  _em_compute_magnitudes(
    fft: number, samples: number, count: number, sr: number, outLen: number,
  ): number;
  _em_find_peak_frequency(
    fft: number, samples: number, count: number, sr: number,
    minFreq: number, maxFreq: number, outMag: number,
  ): number;
  _em_compute_spectrum(
    fft: number, samples: number, count: number, sr: number, window: number,
  ): number;
  _em_spectrum_free(ptr: number): void;
  _em_find_peak_amplitude(samples: number, count: number): number;
  _em_find_negative_peak_amplitude(samples: number, count: number): number;
  _em_compute_rms(samples: number, count: number): number;
  _em_compute_dc_offset(samples: number, count: number): number;
  _em_zero_crossing_rate(samples: number, count: number): number;
  _em_estimate_dominant_frequency(samples: number, count: number, sr: number): number;
  _em_analyze_waveform(samples: number, count: number, sr: number): number;
  _em_amplitude_to_db(a: number): number;
  _em_db_to_amplitude(db: number): number;
  _em_peak_to_dbfs(p: number): number;
  _em_rms_to_dbfs(r: number): number;
  _em_dbfs_to_amplitude(dbfs: number): number;
  _em_crest_factor_db(cf: number): number;
  _em_snr_to_db(s: number, n: number): number;
  _em_analyze_harmonics(samples: number, count: number, sr: number): number;
  _em_harmonic_analysis_free(ptr: number): void;
  _em_compute_spectrogram(
    samples: number, count: number, sr: number, windowSize: number,
    overlap: number, minFreq: number, maxFreq: number, startTimeMs: number,
  ): number;
  _em_spectrogram_free(ptr: number): void;
  _em_compress_waveform(samples: number, count: number): number;
  _em_decompress_waveform(
    data: number, size: number, sampleCount: number, outLen: number,
  ): number;
  _em_compressed_waveform_free(ptr: number): void;
  _em_find_trigger(
    data: number, count: number, edge: number, level: number,
    hysteresis: number, holdoff: number,
  ): number;
  _em_triggered_window(
    data: number, count: number, windowSize: number, edge: number,
    level: number, hysteresis: number, holdoff: number, outLen: number,
  ): number;
  _em_resample_to(data: number, count: number, points: number, outLen: number): number;
  _em_generate_waveform(
    kind: number, frequency: number, amplitude: number, noise: number,
    sr: number, numSamples: number, outLen: number,
  ): number;
  _em_dsp_version(): number;
  ccall: unknown;
  cwrap: unknown;
}

// ---- struct field offsets (wasm32, natural alignment) ----------------- //
// asf32_array { float* data; size_t len; } = 8 bytes
const F32_DATA = 0;
const F32_LEN = 4;
// as_spectrum { asf32_array frequencies; asf32_array magnitudes_db; asf32_array phases;
//   float peak_frequency; float peak_magnitude_db; float sample_rate;
//   int window_size; int has_phases; }
const SPEC_FREQS = 0;          // asf32_array (8)
const SPEC_MAGS = 8;           // asf32_array (8)
const SPEC_PHASES = 16;        // asf32_array (8)
const SPEC_PEAK_FREQ = 24;     // f32
const SPEC_PEAK_MAG = 28;      // f32
const SPEC_SR = 32;            // f32
const SPEC_WINDOW = 36;        // i32
const SPEC_HAS_PHASES = 40;   // i32
// as_waveform_analysis { 9 * float } = 36 bytes
// as_frequency_component { float frequency; float magnitude; uint32 harmonic; float phase; } = 16 bytes
const FC_FREQUENCY = 0;
const FC_MAGNITUDE = 4;
const FC_HARMONIC = 8;
const FC_PHASE = 12;
const FC_SIZE = 16;
// as_harmonic_analysis { as_frequency_component fundamental (16);
//   asf32_array harmonics_flat (8); float thd; float thdn;
//   float signal_energy; float noise_energy; }
const HA_FUND = 0;             // 16 bytes
const HA_HARMONICS = 16;       // asf32_array (8)
const HA_THD = 24;            // f32
const HA_THDN = 28;           // f32
const HA_SIGNAL = 32;         // f32
const HA_NOISE = 36;          // f32
// as_spectrogram_data { asf32_array frequencies (8); asi64_array time_bins (8);
//   asf32_array* magnitude_rows (4); size_t num_rows (4);
//   float sample_rate; int window_size; int overlap; }
const SD_FREQS = 0;
const SD_TIMEBINS = 8;
const SD_ROWS = 16;            // pointer
const SD_NUM_ROWS = 20;
const SD_SR = 24;
const SD_WINDOW = 28;
const SD_OVERLAP = 32;
// as_compressed_waveform { as_bytes data { uint8* data; size_t len } (8);
//   size_t sample_count; size_t original_size; size_t compressed_size; }
const CW_DATA_PTR = 0;
const CW_DATA_LEN = 4;
const CW_SAMPLE_COUNT = 8;
const CW_ORIG_SIZE = 12;
const CW_COMP_SIZE = 16;

const WINDOW_TO_C: Record<WindowType, number> = {
  rectangular: 0, hann: 1, hamming: 2, blackman: 3,
};
const EDGE_TO_C: Record<TriggerEdge, number> = { rising: 0, falling: 1, auto: 2 };
const KIND_TO_C: Record<GeneratorKind, number> = {
  sine: 0, square: 1, sawtooth: 2, triangle: 3, noise: 4,
};
const NOISE_TO_C: Record<NoiseType, number> = { white: 0, pink: 1, brown: 2 };

/** Resolve the WASM module factory for the current environment. */
async function loadModuleFactory(): Promise<DspModuleFactory> {
  // The generated audioscope.js is an ES module whose default export is the
  // MODULARIZE factory. In Node (tests) and bundlers (Vite) the import below
  // resolves to ../dist/audioscope.js; the sibling audioscope.wasm is fetched
  // relative to that script. The d.ts declares a permissive factory; we cast
  // the resolved instance to the precise DspModule interface.
  const mod = (await import("../dist/audioscope.js")) as {
    default?: () => Promise<DspModule>;
  };
  if (typeof mod.default !== "function") {
    throw new Error(
      "audioscope.js did not export a MODULARIZE factory as default. " +
        "Run `pnpm build:wasm` to (re)build the WASM artifact.",
    );
  }
  return mod.default;
}

/**
 * AudioScopeDsp — typed client for the C++ DSP core compiled to WASM.
 *
 * Instantiate once, call {@link load}, then reuse for every frame. The FFT
 * processor handle is held for the lifetime of the instance.
 */
export class AudioScopeDsp {
  private mod!: DspModule;
  private fftHandle = 0;
  private tmpLenPtr = 0;
  private tmpMagPtr = 0;

  /** Whether {@link load} has completed successfully. */
  loaded = false;

  /**
   * Instantiate and load the WASM module. Required before any DSP call.
   * Safe to call multiple times; only the first call loads the module.
   */
  async load(): Promise<void> {
    if (this.loaded) return;
    const factory = await loadModuleFactory();
    this.mod = await factory();
    this.fftHandle = this.mod._em_fft_new();
    // Two scratch pointers reused across calls to avoid per-call malloc churn.
    this.tmpLenPtr = this.mod._malloc(4);
    this.tmpMagPtr = this.mod._malloc(4);
    if (!this.fftHandle || !this.tmpLenPtr || !this.tmpMagPtr) {
      throw new Error("AudioScopeDsp: failed to initialize WASM DSP (alloc failure).");
    }
    this.loaded = true;
  }

  /** Release WASM heap resources. Call when discarding the instance. */
  dispose(): void {
    if (!this.loaded) return;
    if (this.fftHandle) this.mod._em_fft_free(this.fftHandle);
    if (this.tmpLenPtr) this.mod._free(this.tmpLenPtr);
    if (this.tmpMagPtr) this.mod._free(this.tmpMagPtr);
    this.fftHandle = 0;
    this.tmpLenPtr = 0;
    this.tmpMagPtr = 0;
    this.loaded = false;
  }

  // ---- internal helpers ------------------------------------------------ //

  /**
   * Copy a JS sample array into a freshly malloc'd f32 region on the WASM
   * heap and return its pointer. Caller MUST call freeF32(ptr) after use.
   */
  private allocF32(samples: ArrayLike<number>): number {
    const n = samples.length;
    const bytePtr = this.mod._malloc(n * 4);
    if (!bytePtr) return 0;
    this.mod.HEAPF32.set(samples as ArrayLike<number> as Float32Array, bytePtr >> 2);
    return bytePtr;
  }

  private freePtr(ptr: number): void {
    if (ptr) this.mod._em_free(ptr);
  }

  /** Copy `len` f32 values starting at `dataPtr` into a new Float32Array. */
  private copyF32(dataPtr: number, len: number): Float32Array {
    if (!dataPtr || len <= 0) return new Float32Array(0);
    return this.mod.HEAPF32.slice(dataPtr >> 2, (dataPtr >> 2) + len);
  }

  /** Copy `len` bytes starting at `dataPtr` into a new Uint8Array. */
  private copyBytes(dataPtr: number, len: number): Uint8Array {
    if (!dataPtr || len <= 0) return new Uint8Array(0);
    return this.mod.HEAPU8.slice(dataPtr, dataPtr + len);
  }

  /** Read an i32 at `offset` within the struct at `basePtr`. */
  private i32(basePtr: number, offset: number): number {
    return this.mod.getValue(basePtr + offset, "i32");
  }

  /** Read a u32 at `offset` within the struct at `basePtr`. */
  private u32(basePtr: number, offset: number): number {
    return this.mod.getValue(basePtr + offset, "i32") >>> 0;
  }

  /** Read an f32 at `offset` within the struct at `basePtr`. */
  private f32(basePtr: number, offset: number): number {
    return this.mod.getValue(basePtr + offset, "float");
  }

  /** Read a wasm32 pointer (u32) at `offset` within the struct at `basePtr`. */
  private ptr(basePtr: number, offset: number): number {
    return this.mod.getValue(basePtr + offset, "i32") >>> 0;
  }

  /** Deserialize an asf32_array located at `basePtr` into a Float32Array. */
  private readF32Array(basePtr: number): Float32Array {
    const data = this.ptr(basePtr, F32_DATA);
    const len = this.u32(basePtr, F32_LEN);
    return this.copyF32(data, len);
  }

  // ---- public DSP API -------------------------------------------------- //

  /** Build version string from the C++ core (e.g. for diagnostics). */
  version(): string {
    this.requireLoaded();
    const ptr = this.mod._em_dsp_version();
    if (!ptr) return "";
    // C string (UTF-8) — read until NUL via HEAPU8.
    let end = ptr;
    while (this.mod.HEAPU8[end] !== 0) end++;
    return new TextDecoder().decode(this.mod.HEAPU8.subarray(ptr, end));
  }

  /**
   * Hann-windowed half-spectrum magnitudes in dB for a time-domain frame.
   */
  computeMagnitudes(samples: ArrayLike<number>, sampleRate: number): Float32Array {
    this.requireLoaded();
    const ptr = this.allocF32(samples);
    try {
      const dataPtr = this.mod._em_compute_magnitudes(
        this.fftHandle, ptr, samples.length, sampleRate, this.tmpLenPtr,
      );
      const len = this.i32(this.tmpLenPtr, 0);
      const out = this.copyF32(dataPtr, len);
      this.freePtr(dataPtr);
      return out;
    } finally {
      this.freePtr(ptr);
    }
  }

  /**
   * Find the dominant peak frequency in [minFreq, maxFreq]. Returns the
   * frequency in Hz and the magnitude in dB, or null when no peak is found.
   */
  findPeakFrequency(
    samples: ArrayLike<number>, sampleRate: number, minFreq = 20, maxFreq = sampleRate / 2,
  ): { frequency: number; magnitudeDb: number } | null {
    this.requireLoaded();
    const ptr = this.allocF32(samples);
    try {
      const freq = this.mod._em_find_peak_frequency(
        this.fftHandle, ptr, samples.length, sampleRate, minFreq, maxFreq, this.tmpMagPtr,
      );
      if (freq < 0) return null;
      return { frequency: freq, magnitudeDb: this.f32(this.tmpMagPtr, 0) };
    } finally {
      this.freePtr(ptr);
    }
  }

  /** Full spectrum (frequencies + dB magnitudes + peak + optional phases). */
  computeSpectrum(
    samples: ArrayLike<number>, sampleRate: number, window: WindowType = "hann",
  ): Spectrum {
    this.requireLoaded();
    const ptr = this.allocF32(samples);
    let structPtr = 0;
    try {
      structPtr = this.mod._em_compute_spectrum(
        this.fftHandle, ptr, samples.length, sampleRate, WINDOW_TO_C[window],
      );
      const frequencies = this.readF32Array(structPtr + SPEC_FREQS);
      const magnitudesDb = this.readF32Array(structPtr + SPEC_MAGS);
      const phaseData = this.ptr(structPtr, SPEC_PHASES + F32_DATA);
      const phaseLen = this.u32(structPtr, SPEC_PHASES + F32_LEN);
      const hasPhases = this.i32(structPtr, SPEC_HAS_PHASES) === 1;
      const phases = hasPhases ? this.copyF32(phaseData, phaseLen) : null;
      const spectrum: Spectrum = {
        frequencies,
        magnitudesDb,
        phases,
        peakFrequency: this.f32(structPtr, SPEC_PEAK_FREQ),
        peakMagnitudeDb: this.f32(structPtr, SPEC_PEAK_MAG),
        sampleRate: this.f32(structPtr, SPEC_SR),
        windowSize: this.i32(structPtr, SPEC_WINDOW),
        hasPhases,
      };
      return spectrum;
    } finally {
      if (structPtr) this.mod._em_spectrum_free(structPtr);
      this.freePtr(ptr);
    }
  }

  /** Time-domain measurements (peak, RMS, DC, ZCR, dominant freq, THD, SNR). */
  analyzeWaveform(samples: ArrayLike<number>, sampleRate: number): WaveformAnalysis {
    this.requireLoaded();
    const ptr = this.allocF32(samples);
    let structPtr = 0;
    try {
      structPtr = this.mod._em_analyze_waveform(ptr, samples.length, sampleRate);
      // 9 consecutive f32 fields.
      const r = (off: number) => this.f32(structPtr, off);
      return {
        peakAmplitude: r(0),
        negativePeakAmplitude: r(4),
        rmsAmplitude: r(8),
        dcOffset: r(12),
        crestFactor: r(16),
        zeroCrossingRate: r(20),
        dominantFrequency: r(24),
        thd: r(28),
        snr: r(32),
      };
    } finally {
      if (structPtr) this.freePtr(structPtr);
      this.freePtr(ptr);
    }
  }

  findPeakAmplitude(samples: ArrayLike<number>): number {
    return this.scalar(samples, (p, n) => this.mod._em_find_peak_amplitude(p, n));
  }
  findNegativePeakAmplitude(samples: ArrayLike<number>): number {
    return this.scalar(samples, (p, n) => this.mod._em_find_negative_peak_amplitude(p, n));
  }
  computeRms(samples: ArrayLike<number>): number {
    return this.scalar(samples, (p, n) => this.mod._em_compute_rms(p, n));
  }
  computeDcOffset(samples: ArrayLike<number>): number {
    return this.scalar(samples, (p, n) => this.mod._em_compute_dc_offset(p, n));
  }
  zeroCrossingRate(samples: ArrayLike<number>): number {
    return this.scalar(samples, (p, n) => this.mod._em_zero_crossing_rate(p, n));
  }
  estimateDominantFrequency(samples: ArrayLike<number>, sampleRate: number): number {
    this.requireLoaded();
    const ptr = this.allocF32(samples);
    try {
      return this.mod._em_estimate_dominant_frequency(ptr, samples.length, sampleRate);
    } finally {
      this.freePtr(ptr);
    }
  }

  // dB conversions (scalar — no heap traffic).
  amplitudeToDb(a: number): number { this.requireLoaded(); return this.mod._em_amplitude_to_db(a); }
  dbToAmplitude(db: number): number { this.requireLoaded(); return this.mod._em_db_to_amplitude(db); }
  peakToDbfs(p: number): number { this.requireLoaded(); return this.mod._em_peak_to_dbfs(p); }
  rmsToDbfs(r: number): number { this.requireLoaded(); return this.mod._em_rms_to_dbfs(r); }
  dbfsToAmplitude(dbfs: number): number { this.requireLoaded(); return this.mod._em_dbfs_to_amplitude(dbfs); }
  crestFactorDb(cf: number): number { this.requireLoaded(); return this.mod._em_crest_factor_db(cf); }
  snrToDb(signal: number, noise: number): number {
    this.requireLoaded(); return this.mod._em_snr_to_db(signal, noise);
  }

  /** Harmonic analysis (fundamental + harmonics + THD/THDN + energy). */
  analyzeHarmonics(samples: ArrayLike<number>, sampleRate: number): HarmonicAnalysis {
    this.requireLoaded();
    const ptr = this.allocF32(samples);
    let structPtr = 0;
    try {
      structPtr = this.mod._em_analyze_harmonics(ptr, samples.length, sampleRate);
      const fundamental = this.readFrequencyComponent(structPtr + HA_FUND);
      // harmonics_flat is a packed array of as_frequency_component structs,
      // exposed as an f32 array whose len is in f32 units.
      const flatData = this.ptr(structPtr, HA_HARMONICS + F32_DATA);
      const flatLenF32 = this.u32(structPtr, HA_HARMONICS + F32_LEN);
      const nComponents = (flatLenF32 * 4) / FC_SIZE;
      const harmonics: FrequencyComponent[] = [];
      for (let i = 0; i < nComponents; i++) {
        harmonics.push(this.readFrequencyComponent(flatData + i * FC_SIZE));
      }
      return {
        fundamental,
        harmonics,
        thd: this.f32(structPtr, HA_THD),
        thdn: this.f32(structPtr, HA_THDN),
        signalEnergy: this.f32(structPtr, HA_SIGNAL),
        noiseEnergy: this.f32(structPtr, HA_NOISE),
      };
    } finally {
      if (structPtr) this.mod._em_harmonic_analysis_free(structPtr);
      this.freePtr(ptr);
    }
  }

  /** Compute an STFT spectrogram over the given sample range. */
  computeSpectrogram(
    samples: ArrayLike<number>, sampleRate: number, config: SpectrogramConfig,
    startTimeMs = 0,
  ): SpectrogramData {
    this.requireLoaded();
    const ptr = this.allocF32(samples);
    let structPtr = 0;
    try {
      structPtr = this.mod._em_compute_spectrogram(
        ptr, samples.length, sampleRate, config.windowSize, config.overlap,
        config.minFreq, config.maxFreq, startTimeMs,
      );
      const frequencies = this.readF32Array(structPtr + SD_FREQS);
      // time_bins: { int64* data; size_t len } — i64 is 8 bytes; on wasm32 the
      // pointer is 4 bytes and len 4 bytes. Read as Int32 view over pairs.
      const tbData = this.ptr(structPtr, SD_TIMEBINS + F32_DATA);
      const tbLen = this.u32(structPtr, SD_TIMEBINS + F32_LEN);
      const timeBins = new Int32Array(tbLen);
      for (let i = 0; i < tbLen; i++) {
        // little-endian low 32 bits of each i64 (ms timestamps fit in 32 bits).
        timeBins[i] = this.mod.getValue(tbData + i * 8, "i32");
      }
      const rowsPtr = this.ptr(structPtr, SD_ROWS);
      const numRows = this.u32(structPtr, SD_NUM_ROWS);
      const magnitudes: Float32Array[] = [];
      for (let i = 0; i < numRows; i++) {
        // Each entry is an asf32_array (8 bytes) in the magnitude_rows array.
        const rowBase = this.mod.getValue(rowsPtr + i * 8, "i32");
        magnitudes.push(this.readF32Array(rowBase));
      }
      return {
        frequencies,
        timeBins,
        magnitudes,
        sampleRate: this.f32(structPtr, SD_SR),
        windowSize: this.i32(structPtr, SD_WINDOW),
        overlap: this.i32(structPtr, SD_OVERLAP),
      };
    } finally {
      if (structPtr) this.mod._em_spectrogram_free(structPtr);
      this.freePtr(ptr);
    }
  }

  /** LZ4-compress a sample buffer. */
  compressWaveform(samples: ArrayLike<number>): CompressedWaveform {
    this.requireLoaded();
    const ptr = this.allocF32(samples);
    let structPtr = 0;
    try {
      structPtr = this.mod._em_compress_waveform(ptr, samples.length);
      const dataPtr = this.ptr(structPtr, CW_DATA_PTR);
      const dataLen = this.u32(structPtr, CW_DATA_LEN);
      return {
        data: this.copyBytes(dataPtr, dataLen),
        sampleCount: this.u32(structPtr, CW_SAMPLE_COUNT),
        originalSize: this.u32(structPtr, CW_ORIG_SIZE),
        compressedSize: this.u32(structPtr, CW_COMP_SIZE),
      };
    } finally {
      if (structPtr) this.mod._em_compressed_waveform_free(structPtr);
      this.freePtr(ptr);
    }
  }

  /** LZ4-decompress a buffer back into samples. Returns null on decode error. */
  decompressWaveform(data: Uint8Array, sampleCount: number): Float32Array | null {
    this.requireLoaded();
    const ptr = this.mod._malloc(data.length);
    if (!ptr) return null;
    try {
      this.mod.HEAPU8.set(data, ptr);
      const dataPtr = this.mod._em_decompress_waveform(
        ptr, data.length, sampleCount, this.tmpLenPtr,
      );
      if (!dataPtr) return null;
      const len = this.i32(this.tmpLenPtr, 0);
      const out = this.copyF32(dataPtr, len);
      this.freePtr(dataPtr);
      return out;
    } finally {
      this.mod._free(ptr);
    }
  }

  /** Find the first trigger crossing. Returns the index or -1. */
  findTrigger(data: ArrayLike<number>, options: TriggerOptions): TriggerResult {
    this.requireLoaded();
    const ptr = this.allocF32(data);
    try {
      const idx = this.mod._em_find_trigger(
        ptr, data.length, EDGE_TO_C[options.edge], options.level,
        options.hysteresis ?? 0.02, options.holdoff ?? 0,
      );
      return { index: idx, armed: idx >= 0 };
    } finally {
      this.freePtr(ptr);
    }
  }

  /**
   * Align a frame on the trigger point and return a `windowSize` window.
   * Returns null when the trigger never fires (caller free-runs or holds).
   */
  triggeredWindow(
    data: ArrayLike<number>, windowSize: number, options: TriggerOptions,
  ): Float32Array | null {
    this.requireLoaded();
    const ptr = this.allocF32(data);
    try {
      const dataPtr = this.mod._em_triggered_window(
        ptr, data.length, windowSize, EDGE_TO_C[options.edge], options.level,
        options.hysteresis ?? 0.02, options.holdoff ?? 0, this.tmpLenPtr,
      );
      if (!dataPtr) return null;
      const len = this.i32(this.tmpLenPtr, 0);
      const out = this.copyF32(dataPtr, len);
      this.freePtr(dataPtr);
      return out;
    } finally {
      this.freePtr(ptr);
    }
  }

  /** Nearest-neighbor resample to exactly `points` samples. */
  resampleTo(data: ArrayLike<number>, points: number): Float32Array {
    this.requireLoaded();
    const ptr = this.allocF32(data);
    try {
      const dataPtr = this.mod._em_resample_to(ptr, data.length, points, this.tmpLenPtr);
      const len = this.i32(this.tmpLenPtr, 0);
      const out = this.copyF32(dataPtr, len);
      this.freePtr(dataPtr);
      return out;
    } finally {
      this.freePtr(ptr);
    }
  }

  /**
   * Synthesize a test waveform (sine/square/saw/triangle/noise) via the C++
   * generators. Replaces the TS mock synthesizer in use-mock-audio-analyzer.
   */
  generateWaveform(opts: {
    kind: GeneratorKind;
    frequency?: number;
    amplitude?: number;
    noiseType?: NoiseType;
    sampleRate: number;
    numSamples: number;
  }): Float32Array {
    this.requireLoaded();
    const dataPtr = this.mod._em_generate_waveform(
      KIND_TO_C[opts.kind], opts.frequency ?? 440, opts.amplitude ?? 1,
      NOISE_TO_C[opts.noiseType ?? "white"], opts.sampleRate, opts.numSamples, this.tmpLenPtr,
    );
    const len = this.i32(this.tmpLenPtr, 0);
    const out = this.copyF32(dataPtr, len);
    this.freePtr(dataPtr);
    return out;
  }

  // ---- private helpers ------------------------------------------------- //

  private requireLoaded(): void {
    if (!this.loaded) {
      throw new Error("AudioScopeDsp not loaded — call await dsp.load() first.");
    }
  }

  /** Helper for scalar-returning sample-array functions (no struct). */
  private scalar(
    samples: ArrayLike<number>, fn: (ptr: number, count: number) => number,
  ): number {
    this.requireLoaded();
    const ptr = this.allocF32(samples);
    try {
      return fn(ptr, samples.length);
    } finally {
      this.freePtr(ptr);
    }
  }

  /** Deserialize a single as_frequency_component at `basePtr`. */
  private readFrequencyComponent(basePtr: number): FrequencyComponent {
    return {
      frequency: this.f32(basePtr, FC_FREQUENCY),
      magnitude: this.f32(basePtr, FC_MAGNITUDE),
      harmonic: this.u32(basePtr, FC_HARMONIC),
      phase: this.f32(basePtr, FC_PHASE),
    };
  }
}
