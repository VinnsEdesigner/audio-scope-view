// dsp-loader.ts — process-wide singleton for the WASM DSP core.
//
// The C++ DSP core compiled to WebAssembly (packages/dsp-wasm) is expensive to
// instantiate (fetch + compile + init), so it must be loaded exactly once and
// shared by every consumer: the scope renderer (FFT/spectrum/trigger), the live
// capture analyzer (RMS/peak/frequency), the mock synthesizer (generators), and
// the measurements dialog.
//
// `getDsp()` returns the loaded instance synchronously (or null if still
// loading / failed). `ensureDsp()` kicks off the load and awaits it. Consumers
// that run on the rAF hot path read getDsp() and fall back to the TS helpers
// when null, so the UI never blocks on module load.

import { AudioScopeDsp } from "@audio-scope-view/dsp-wasm";

let dsp: AudioScopeDsp | null = null;
let loadPromise: Promise<AudioScopeDsp | null> | null = null;
let loadFailed = false;

/**
 * Kick off (or reuse) the async WASM load. Resolves to the loaded instance or
 * null if the module could not be loaded (e.g. unsupported environment). Safe to
 * call repeatedly; only the first call actually loads.
 */
export function ensureDsp(): Promise<AudioScopeDsp | null> {
  if (dsp) return Promise.resolve(dsp);
  if (loadPromise) return loadPromise;
  if (loadFailed) return Promise.resolve(null);

  loadPromise = (async () => {
    try {
      const instance = new AudioScopeDsp();
      await instance.load();
      dsp = instance;
      return dsp;
    } catch (error) {
      console.warn("[dsp-wasm] failed to load WASM DSP core; falling back to TS:", error);
      loadFailed = true;
      return null;
    }
  })();
  return loadPromise;
}

/**
 * Synchronously return the loaded DSP instance, or null if not yet loaded /
 * unavailable. Hot-path callers use this and degrade gracefully when null.
 */
export function getDsp(): AudioScopeDsp | null {
  return dsp;
}
