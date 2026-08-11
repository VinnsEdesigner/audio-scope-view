// emscripten_main.cpp — WebAssembly entry point over the C++ DSP core.
//
// This is the WASM/JS analog of `sdk/bindings/ffi/audioscope_ffi.cpp`: a flat
// C ABI consumed by the TypeScript wrapper in `packages/dsp-wasm`. It reuses
// the SAME `audioscope_ffi` C functions (the single FFI seam — no second DSP
// copy), and adapts them to the robust Emscripten calling convention.
//
// Why wrappers instead of exporting audioscope_ffi directly: the audioscope_ffi
// functions return composite structs (as_spectrum, as_harmonic_analysis, …)
// and array handles (asf32_array) BY VALUE. Emscripten's ccall/cwrap cannot
// reliably read by-value struct returns (the sret ABI varies). The wrappers
// below turn those into returns that JS can read unambiguously:
//
//   • Array-returning ops → return the malloc'd data pointer and write the
//     element count to an `out_len` int. JS copies from HEAPF32/HEAPU8 then
//     calls em_free(ptr).
//   • Composite-struct ops → malloc a copy of the struct on the WASM heap and
//     return its pointer. JS reads fields at fixed offsets, follows inner
//     pointers, copies, then calls the composite's `*_free` (which frees the
//     inner arrays) followed by em_free(ptr) for the holder.
//   • Scalar-returning ops (dB helpers, rms, peak, version) → direct.
//
// All KEEPALIVE functions are `extern "C"` (unmangled) so EXPORTED_FUNCTIONS
// can list them by the exact `em_*` name.

#include "audioscope_ffi.h"

#include <cstdlib>
#include <cstring>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

// All exports below are extern "C" (unmangled) so the EXPORTED_FUNCTIONS
// list can reference them by their exact `em_*` name, and so cwrap/ccall can
// bind them from JS without demangling.
extern "C" {

// --------------------------------------------------------------------- //
// General allocator helpers exposed to JS.
// --------------------------------------------------------------------- //

// free a malloc'd pointer returned by the em_* array wrappers.
EMSCRIPTEN_KEEPALIVE
void em_free(void *p) { std::free(p); }

// malloc `n` bytes on the WASM heap (JS uses this to allocate input buffers
// before calling the em_* functions). Returns 0 on failure.
EMSCRIPTEN_KEEPALIVE
void *em_alloc(size_t n) { return std::malloc(n); }

// --------------------------------------------------------------------- //
// FFT processor (opaque handle; reuse across calls).
// --------------------------------------------------------------------- //

EMSCRIPTEN_KEEPALIVE
AudioscopeFft *em_fft_new(void) { return as_fft_new(); }

EMSCRIPTEN_KEEPALIVE
void em_fft_free(AudioscopeFft *fft) { as_fft_free(fft); }

// compute_magnitudes: writes dB magnitudes (half-spectrum) into a malloc'd
// buffer; returns its pointer and writes the count to *out_len. JS copies then
// calls em_free(returned_ptr).
EMSCRIPTEN_KEEPALIVE
float *em_compute_magnitudes(AudioscopeFft *fft, const float *samples, int count,
                             float sample_rate, int *out_len) {
    asf32_array a = as_fft_compute_magnitudes(fft, samples, (size_t)count, sample_rate);
    if (out_len) *out_len = (int)a.len;
    return a.data;  // may be null when empty; JS handles null
}

// find_peak_frequency: returns the peak frequency and writes the magnitude to
// *out_mag. Returns < 0 when no peak is found.
EMSCRIPTEN_KEEPALIVE
float em_find_peak_frequency(AudioscopeFft *fft, const float *samples, int count,
                             float sample_rate, float min_freq, float max_freq,
                             float *out_mag) {
    float freq = -1.0f, mag = 0.0f;
    int ok = as_fft_find_peak_frequency(fft, samples, (size_t)count, sample_rate,
                                        min_freq, max_freq, &freq, &mag);
    if (out_mag) *out_mag = mag;
    return ok == 1 ? freq : -1.0f;
}

// compute_spectrum: returns a malloc'd as_spectrum holder pointer. JS reads
// the inner arrays + scalars, then calls em_spectrum_free(ptr).
EMSCRIPTEN_KEEPALIVE
as_spectrum *em_compute_spectrum(AudioscopeFft *fft, const float *samples, int count,
                                 float sample_rate, int window) {
    as_spectrum s = as_fft_compute_spectrum(fft, samples, (size_t)count, sample_rate,
                                            (as_window_type)window);
    as_spectrum *p = (as_spectrum *)std::malloc(sizeof(as_spectrum));
    if (p) *p = s;
    return p;
}

EMSCRIPTEN_KEEPALIVE
void em_spectrum_free(as_spectrum *p) {
    if (!p) return;
    as_spectrum_free(p);  // frees inner arrays
    std::free(p);          // frees the holder
}

// --------------------------------------------------------------------- //
// Time-domain measurements (scalars — direct).
// --------------------------------------------------------------------- //

EMSCRIPTEN_KEEPALIVE
float em_find_peak_amplitude(const float *samples, int count) {
    return as_find_peak_amplitude(samples, (size_t)count);
}
EMSCRIPTEN_KEEPALIVE
float em_find_negative_peak_amplitude(const float *samples, int count) {
    return as_find_negative_peak_amplitude(samples, (size_t)count);
}
EMSCRIPTEN_KEEPALIVE
float em_compute_rms(const float *samples, int count) {
    return as_compute_rms(samples, (size_t)count);
}
EMSCRIPTEN_KEEPALIVE
float em_compute_dc_offset(const float *samples, int count) {
    return as_compute_dc_offset(samples, (size_t)count);
}
EMSCRIPTEN_KEEPALIVE
float em_zero_crossing_rate(const float *samples, int count) {
    return as_zero_crossing_rate(samples, (size_t)count);
}
EMSCRIPTEN_KEEPALIVE
float em_estimate_dominant_frequency(const float *samples, int count, float sample_rate) {
    return as_estimate_dominant_frequency(samples, (size_t)count, sample_rate);
}

// analyze_waveform: returns a malloc'd as_waveform_analysis holder pointer.
// JS reads the 9 scalar fields then calls em_free(ptr).
EMSCRIPTEN_KEEPALIVE
as_waveform_analysis *em_analyze_waveform(const float *samples, int count, float sample_rate) {
    as_waveform_analysis a = as_analyze_waveform(samples, (size_t)count, sample_rate);
    as_waveform_analysis *p = (as_waveform_analysis *)std::malloc(sizeof(as_waveform_analysis));
    if (p) *p = a;
    return p;
}

// dB conversions (direct, scalar in / scalar out).
EMSCRIPTEN_KEEPALIVE float em_amplitude_to_db(float a)        { return as_amplitude_to_db(a); }
EMSCRIPTEN_KEEPALIVE float em_db_to_amplitude(float db)       { return as_db_to_amplitude(db); }
EMSCRIPTEN_KEEPALIVE float em_peak_to_dbfs(float p)           { return as_peak_to_dbfs(p); }
EMSCRIPTEN_KEEPALIVE float em_rms_to_dbfs(float r)           { return as_rms_to_dbfs(r); }
EMSCRIPTEN_KEEPALIVE float em_dbfs_to_amplitude(float dbfs)  { return as_dbfs_to_amplitude(dbfs); }
EMSCRIPTEN_KEEPALIVE float em_crest_factor_db(float cf)      { return as_crest_factor_db(cf); }
EMSCRIPTEN_KEEPALIVE float em_snr_to_db(float s, float n)    { return as_snr_to_db(s, n); }

// --------------------------------------------------------------------- //
// Harmonic analysis (composite struct — malloc'd holder pointer).
// --------------------------------------------------------------------- //

EMSCRIPTEN_KEEPALIVE
as_harmonic_analysis *em_analyze_harmonics(const float *samples, int count, float sample_rate) {
    as_harmonic_analysis h = as_analyze_harmonics(samples, (size_t)count, sample_rate);
    as_harmonic_analysis *p = (as_harmonic_analysis *)std::malloc(sizeof(as_harmonic_analysis));
    if (p) *p = h;
    return p;
}

EMSCRIPTEN_KEEPALIVE
void em_harmonic_analysis_free(as_harmonic_analysis *p) {
    if (!p) return;
    as_harmonic_analysis_free(p);
    std::free(p);
}

// --------------------------------------------------------------------- //
// Spectrogram (composite struct with array-of-arrays).
// --------------------------------------------------------------------- //

EMSCRIPTEN_KEEPALIVE
as_spectrogram_data *em_compute_spectrogram(const float *samples, int count, float sample_rate,
                                            int window_size, int overlap, float min_freq,
                                            float max_freq, int start_time_ms) {
    as_spectrogram_config cfg;
    cfg.window_size = window_size;
    cfg.overlap     = overlap;
    cfg.min_freq    = min_freq;
    cfg.max_freq    = max_freq;
    as_spectrogram_data d = as_spectrogram_compute(samples, (size_t)count, sample_rate,
                                                   cfg, (int64_t)start_time_ms);
    as_spectrogram_data *p = (as_spectrogram_data *)std::malloc(sizeof(as_spectrogram_data));
    if (p) *p = d;
    return p;
}

EMSCRIPTEN_KEEPALIVE
void em_spectrogram_free(as_spectrogram_data *p) {
    if (!p) return;
    as_spectrogram_free(p);
    std::free(p);
}

// --------------------------------------------------------------------- //
// Compression (LZ4).
// --------------------------------------------------------------------- //

// compress: returns a malloc'd as_compressed_waveform holder pointer. The data
// bytes live in `data.data` (a malloc'd buffer). JS copies data.data[0..len]
// then calls em_compressed_waveform_free(ptr).
EMSCRIPTEN_KEEPALIVE
as_compressed_waveform *em_compress_waveform(const float *samples, int count) {
    as_compressed_waveform c = as_compress_waveform(samples, (size_t)count);
    as_compressed_waveform *p = (as_compressed_waveform *)std::malloc(sizeof(as_compressed_waveform));
    if (p) *p = c;
    return p;
}

// decompress: writes the decoded samples into a malloc'd buffer; returns its
// pointer and writes the count to *out_len. Returns null on decode failure.
EMSCRIPTEN_KEEPALIVE
float *em_decompress_waveform(const uint8_t *data, int size, int sample_count, int *out_len) {
    asf32_array out{};
    int ok = as_decompress_waveform(data, (size_t)size, (size_t)sample_count, &out);
    if (ok != 1) { asf32_array_free(out); return nullptr; }
    if (out_len) *out_len = (int)out.len;
    return out.data;
}

EMSCRIPTEN_KEEPALIVE
void em_compressed_waveform_free(as_compressed_waveform *p) {
    if (!p) return;
    as_compressed_waveform_free(p);
    std::free(p);
}

// --------------------------------------------------------------------- //
// Trigger detection.
// --------------------------------------------------------------------- //

// find_trigger: returns the trigger index (>= 0) or -1.
EMSCRIPTEN_KEEPALIVE
int em_find_trigger(const float *data, int count, int edge, float level,
                    float hysteresis, int holdoff) {
    as_trigger_options opts;
    opts.edge        = (as_trigger_edge)edge;
    opts.level      = level;
    opts.hysteresis = hysteresis;
    opts.holdoff    = (int64_t)holdoff;
    as_trigger_result r = as_find_trigger(data, (size_t)count, opts);
    return r.index;
}

// triggered_window: returns a malloc'd window buffer + writes count to *out_len.
EMSCRIPTEN_KEEPALIVE
float *em_triggered_window(const float *data, int count, int window_size,
                           int edge, float level, float hysteresis, int holdoff,
                           int *out_len) {
    as_trigger_options opts;
    opts.edge        = (as_trigger_edge)edge;
    opts.level      = level;
    opts.hysteresis = hysteresis;
    opts.holdoff    = (int64_t)holdoff;
    asf32_array w = as_triggered_window(data, (size_t)count, (size_t)window_size, opts);
    if (out_len) *out_len = (int)w.len;
    return w.data;
}

// resample_to: returns a malloc'd buffer + writes count to *out_len.
EMSCRIPTEN_KEEPALIVE
float *em_resample_to(const float *data, int count, int points, int *out_len) {
    asf32_array r = as_resample_to(data, (size_t)count, points);
    if (out_len) *out_len = (int)r.len;
    return r.data;
}

// --------------------------------------------------------------------- //
// Waveform generators.
// --------------------------------------------------------------------- //

// generate_waveform: returns a malloc'd buffer + writes count to *out_len.
EMSCRIPTEN_KEEPALIVE
float *em_generate_waveform(int kind, double frequency, float amplitude, int noise,
                            double sample_rate, int num_samples, int *out_len) {
    asf32_array g = as_generate_waveform((as_generator_kind)kind, frequency, amplitude,
                                         (as_noise_type)noise, sample_rate,
                                         (size_t)num_samples);
    if (out_len) *out_len = (int)g.len;
    return g.data;
}

// --------------------------------------------------------------------- //
// Version (string — exported directly).
// --------------------------------------------------------------------- //

EMSCRIPTEN_KEEPALIVE
const char *em_dsp_version(void) { return as_dsp_version(); }

} // extern "C"
