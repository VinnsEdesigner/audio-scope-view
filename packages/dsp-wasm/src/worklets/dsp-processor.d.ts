// dsp-processor.d.ts — type declarations for the AudioWorklet module.
//
// The worklet itself is plain JS (AudioWorkletGlobalScope has no module
// loader), but consumers import it by URL, so this declaration gives them
// typed `AudioWorkletNode` ports.

declare module "./dsp-processor" {
  /** Message posted once the WASM module is loaded and ready. */
  export interface ReadyMessage {
    type: "ready";
    version: string;
  }
  /** Per-block frame: FFT magnitudes (dB) + time-domain measurements. */
  export interface FrameMessage {
    type: "frame";
    magnitudes: Float32Array;
    analysis: import("../types").WaveformAnalysis;
  }
  /** One-shot spectrum response (main-thread `analyze` request). */
  export interface SpectrumMessage {
    type: "spectrum";
    spectrum: import("../types").Spectrum;
  }
  /** Load/init failure surfaced from the worklet. */
  export interface ErrorMessage {
    type: "error";
    message: string;
  }
  export type DspWorkletMessage =
    | ReadyMessage
    | FrameMessage
    | SpectrumMessage
    | ErrorMessage;

  export interface AnalyzeRequest {
    type: "analyze";
    samples: Float32Array;
  }
  export type DspWorkletRequest = AnalyzeRequest;

  export const _default: string;
  export default _default;
}
