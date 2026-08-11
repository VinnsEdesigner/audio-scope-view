// dist/audioscope.d.ts — type declaration for the generated WASM module.
//
// The audioscope.js artifact is produced by `pnpm build:wasm` (sdk/wasm/) and
// is an ES module whose default export is a MODULARIZE factory returning the
// initialized module instance. The wrapper (audioscope-dsp.ts) casts the
// instance to the precise DspModule interface it expects, so this declaration
// only needs to be a permissive factory shape that satisfies the import.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DspModuleInstance = Record<string, any>;

declare function AudioScopeDspModuleFactory(): Promise<DspModuleInstance>;

export default AudioScopeDspModuleFactory;
