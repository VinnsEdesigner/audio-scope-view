// index.ts — public entry point for @audio-scope-view/dsp-wasm.
//
// Re-exports the typed WASM DSP client and the TS types that mirror the C++
// core structs. The browser/worklet consumes this; the WASM artifact is built
// from sdk/wasm/ via `pnpm build:wasm` and staged to ../dist/.

export { AudioScopeDsp } from "./audioscope-dsp";
export type {
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
