// types.ts — TypeScript interfaces mirroring the C++ DSP core structs.
//
// These mirror the C ABI types defined in sdk/bindings/ffi/audioscope_ffi.h and
// the WASM KEEPALIVE wrappers in sdk/wasm/emscripten_main.cpp. The
// `audioscope-dsp.ts` wrapper deserializes raw WASM heap memory into these.

export type WindowType = "rectangular" | "hann" | "hamming" | "blackman";

export type TriggerEdge = "rising" | "falling" | "auto";

export interface TriggerOptions {
  edge: TriggerEdge;
  level: number;
  hysteresis?: number;
  /** Ignore this many samples at the start (holdoff). */
  holdoff?: number;
}

export interface TriggerResult {
  /** Trigger sample index, or -1 when no crossing is found. */
  index: number;
  armed: boolean;
}

export type GeneratorKind = "sine" | "square" | "sawtooth" | "triangle" | "noise";
export type NoiseType = "white" | "pink" | "brown";

export interface Spectrum {
  /** Bin center frequencies, in Hz (half-spectrum). */
  frequencies: Float32Array;
  /** Magnitude per bin, in dB (floored at -100). */
  magnitudesDb: Float32Array;
  /** Phase per bin (present only when computed; otherwise null). */
  phases: Float32Array | null;
  peakFrequency: number;
  peakMagnitudeDb: number;
  sampleRate: number;
  /** Input frame count the spectrum was computed from. */
  windowSize: number;
  hasPhases: boolean;
}

export interface WaveformAnalysis {
  peakAmplitude: number;
  negativePeakAmplitude: number;
  rmsAmplitude: number;
  dcOffset: number;
  crestFactor: number;
  zeroCrossingRate: number;
  dominantFrequency: number;
  /** Total harmonic distortion, 0..1 (fraction, not percent). */
  thd: number;
  /** Signal-to-noise ratio, in dB. */
  snr: number;
}

export interface FrequencyComponent {
  frequency: number;
  magnitude: number;
  /** 1 = fundamental, 2 = 2nd harmonic, … */
  harmonic: number;
  phase: number;
}

export interface HarmonicAnalysis {
  fundamental: FrequencyComponent;
  harmonics: FrequencyComponent[];
  /** 0..1 (fraction). */
  thd: number;
  /** 0..1 (fraction). */
  thdn: number;
  signalEnergy: number;
  noiseEnergy: number;
}

export interface SpectrogramConfig {
  windowSize: number;
  overlap: number;
  minFreq: number;
  maxFreq: number;
}

export interface SpectrogramData {
  /** Per frequency bin, in Hz. */
  frequencies: Float32Array;
  /** Per time slice, in ms. */
  timeBins: Int32Array;
  /**
   * Magnitude rows (dB), one Float32Array per time slice. Row length equals
   * frequencies.length.
   */
  magnitudes: Float32Array[];
  sampleRate: number;
  windowSize: number;
  overlap: number;
}

export interface CompressedWaveform {
  data: Uint8Array;
  sampleCount: number;
  originalSize: number;
  compressedSize: number;
}
