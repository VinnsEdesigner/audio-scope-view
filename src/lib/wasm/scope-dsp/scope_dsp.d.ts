/* tslint:disable */
/* eslint-disable */

export class Measurements {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    dc_offset: number;
    frequency: number;
    max: number;
    min: number;
    peak_to_peak: number;
    rms: number;
}

/**
 * Signal-processing engine for the phone-ADC/mic oscilloscope.
 *
 * Samples are pushed in from the Web Audio pipeline. The engine keeps a
 * ring buffer, finds a stable trigger point (rising/falling edge across a
 * level), and returns a fixed-length window for the canvas to draw. It also
 * computes standard scope measurements and an FFT magnitude spectrum.
 */
export class ScopeEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Return a triggered window of `window_len` samples.
     * `edge`: 1 = rising, -1 = falling, 0 = free run (auto).
     */
    frame(window_len: number, level: number, edge: number): Float32Array;
    measure(): Measurements;
    constructor(capacity: number, sample_rate: number);
    /**
     * Push a block of samples from the mic/ADC line.
     */
    push(samples: Float32Array): void;
    /**
     * FFT magnitude spectrum (single-sided). Returns `size/2` bins.
     */
    spectrum(size: number): Float32Array;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_get_measurements_dc_offset: (a: number) => number;
    readonly __wbg_get_measurements_frequency: (a: number) => number;
    readonly __wbg_get_measurements_max: (a: number) => number;
    readonly __wbg_get_measurements_min: (a: number) => number;
    readonly __wbg_get_measurements_peak_to_peak: (a: number) => number;
    readonly __wbg_get_measurements_rms: (a: number) => number;
    readonly __wbg_measurements_free: (a: number, b: number) => void;
    readonly __wbg_scopeengine_free: (a: number, b: number) => void;
    readonly __wbg_set_measurements_dc_offset: (a: number, b: number) => void;
    readonly __wbg_set_measurements_frequency: (a: number, b: number) => void;
    readonly __wbg_set_measurements_max: (a: number, b: number) => void;
    readonly __wbg_set_measurements_min: (a: number, b: number) => void;
    readonly __wbg_set_measurements_peak_to_peak: (a: number, b: number) => void;
    readonly __wbg_set_measurements_rms: (a: number, b: number) => void;
    readonly scopeengine_frame: (a: number, b: number, c: number, d: number) => [number, number];
    readonly scopeengine_measure: (a: number) => number;
    readonly scopeengine_new: (a: number, b: number) => number;
    readonly scopeengine_push: (a: number, b: number, c: number) => void;
    readonly scopeengine_spectrum: (a: number, b: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
