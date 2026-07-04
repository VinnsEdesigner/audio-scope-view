/* @ts-self-types="./scope_dsp.d.ts" */

export class Measurements {
    static __wrap(ptr) {
        const obj = Object.create(Measurements.prototype);
        obj.__wbg_ptr = ptr;
        MeasurementsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MeasurementsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_measurements_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get dc_offset() {
        const ret = wasm.__wbg_get_measurements_dc_offset(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get frequency() {
        const ret = wasm.__wbg_get_measurements_frequency(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get max() {
        const ret = wasm.__wbg_get_measurements_max(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get min() {
        const ret = wasm.__wbg_get_measurements_min(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get peak_to_peak() {
        const ret = wasm.__wbg_get_measurements_peak_to_peak(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get rms() {
        const ret = wasm.__wbg_get_measurements_rms(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set dc_offset(arg0) {
        wasm.__wbg_set_measurements_dc_offset(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set frequency(arg0) {
        wasm.__wbg_set_measurements_frequency(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set max(arg0) {
        wasm.__wbg_set_measurements_max(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set min(arg0) {
        wasm.__wbg_set_measurements_min(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set peak_to_peak(arg0) {
        wasm.__wbg_set_measurements_peak_to_peak(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set rms(arg0) {
        wasm.__wbg_set_measurements_rms(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) Measurements.prototype[Symbol.dispose] = Measurements.prototype.free;

/**
 * Signal-processing engine for the phone-ADC/mic oscilloscope.
 *
 * Samples are pushed in from the Web Audio pipeline. The engine keeps a
 * ring buffer, finds a stable trigger point (rising/falling edge across a
 * level), and returns a fixed-length window for the canvas to draw. It also
 * computes standard scope measurements and an FFT magnitude spectrum.
 */
export class ScopeEngine {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ScopeEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_scopeengine_free(ptr, 0);
    }
    /**
     * Return a triggered window of `window_len` samples.
     * `edge`: 1 = rising, -1 = falling, 0 = free run (auto).
     * @param {number} window_len
     * @param {number} level
     * @param {number} edge
     * @returns {Float32Array}
     */
    frame(window_len, level, edge) {
        const ret = wasm.scopeengine_frame(this.__wbg_ptr, window_len, level, edge);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {Measurements}
     */
    measure() {
        const ret = wasm.scopeengine_measure(this.__wbg_ptr);
        return Measurements.__wrap(ret);
    }
    /**
     * @param {number} capacity
     * @param {number} sample_rate
     */
    constructor(capacity, sample_rate) {
        const ret = wasm.scopeengine_new(capacity, sample_rate);
        this.__wbg_ptr = ret;
        ScopeEngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Push a block of samples from the mic/ADC line.
     * @param {Float32Array} samples
     */
    push(samples) {
        const ptr0 = passArrayF32ToWasm0(samples, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.scopeengine_push(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * FFT magnitude spectrum (single-sided). Returns `size/2` bins.
     * @param {number} size
     * @returns {Float32Array}
     */
    spectrum(size) {
        const ret = wasm.scopeengine_spectrum(this.__wbg_ptr, size);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
}
if (Symbol.dispose) ScopeEngine.prototype[Symbol.dispose] = ScopeEngine.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_344f42d3211c4765: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./scope_dsp_bg.js": import0,
    };
}

const MeasurementsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_measurements_free(ptr, 1));
const ScopeEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_scopeengine_free(ptr, 1));

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('scope_dsp_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
