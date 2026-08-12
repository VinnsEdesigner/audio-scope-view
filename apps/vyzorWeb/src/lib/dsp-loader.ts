// dsp-loader.ts — process-wide singleton for the WASM DSP core.
//
// The C++ DSP core compiled to WebAssembly (packages/dsp-wasm) is expensive to
// instantiate (fetch + compile + init), so it must be loaded exactly once and


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

export function getDsp(): AudioScopeDsp | null {
  return dsp;
}
