// dsp-processor.js — AudioWorkletProcessor that runs the C++ DSP core in a
// real-time audio worklet thread.
//
// Loaded via `audioContext.audioWorklet.addModule(...)`. It instantiates the
// WASM module once (worklet-scoped — the import resolves to the staged
// audioscope.js, with the sibling audioscope.wasm fetched relative to it),
// then for each process() block copies the input samples into the WASM heap,
// runs `computeMagnitudes` + `analyzeWaveform`, and posts the results to the
// main thread for the WebGL renderer.
//
// Why a worklet: the sample-to-pixel hot path must never block the main thread
// or be interrupted by GC. The worklet owns its own real-time priority thread.

import { AudioScopeDsp } from "../audioscope-dsp";

class DspProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this.dsp = null;
    this.sampleRate = sampleRate; // global provided by AudioWorkletGlobalScope
    this._init().catch((err) => {
      // Surface worklet-load failures to the main thread.
      this.port.postMessage({ type: "error", message: String(err && err.message || err) });
    });
    this.port.onmessage = (e) => this._onMessage(e.data);
  }

  async _init() {
    this.dsp = new AudioScopeDsp();
    await this.dsp.load();
    this.port.postMessage({ type: "ready", version: this.dsp.version() });
  }

  _onMessage(msg) {
    if (!this.dsp || !this.dsp.loaded) return;
    // Main thread can request a one-shot analysis (e.g. spectrum/spectrogram)
    // outside the per-block path.
    if (msg?.type === "analyze" && msg.samples) {
      const spectrum = this.dsp.computeSpectrum(msg.samples, this.sampleRate);
      this.port.postMessage({ type: "spectrum", spectrum }, this._transfer(spectrum));
    }
  }

  process(inputs) {
    if (!this.dsp || !this.dsp.loaded) return true;
    const input = inputs[0]?.[0];
    if (!input || input.length === 0) return true;

    // Per-block: copy the input frame into the WASM heap, compute magnitudes
    // + measurements, and post them to the main thread. The renderer reads the
    // typed arrays directly (transfered, zero-copy).
    const samples = input;
    const magnitudes = this.dsp.computeMagnitudes(samples, this.sampleRate);
    const analysis = this.dsp.analyzeWaveform(samples, this.sampleRate);
    this.port.postMessage(
      { type: "frame", magnitudes, analysis },
      [magnitudes.buffer],
    );
    return true;
  }

  _transfer(spectrum) {
    const out = [spectrum.frequencies.buffer, spectrum.magnitudesDb.buffer];
    if (spectrum.phases) out.push(spectrum.phases.buffer);
    return out;
  }
}

registerProcessor("audioscope-dsp-processor", DspProcessor);
