// Client-only loader for the Rust DSP engine (compiled to WebAssembly).
// Never import this from SSR/loader code paths — call `loadScopeEngine()`
// after mount (inside useEffect) so the .wasm is fetched in the browser.
import init, { ScopeEngine } from "@/lib/wasm/scope-dsp/scope_dsp.js";

let ready: Promise<void> | null = null;

export async function loadScopeEngine(
  capacity: number,
  sampleRate: number,
): Promise<ScopeEngine> {
  if (!ready) ready = init().then(() => undefined);
  await ready;
  return new ScopeEngine(capacity, sampleRate);
}

export type { ScopeEngine };