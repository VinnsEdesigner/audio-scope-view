// audioscope_ffi.h — C ABI over the C++ DSP core.
//
// This is the single FFI seam. Every host language (Rust server, WASM/JS,
// Android JNI, Python) binds to these C functions — not to the C++ classes
// directly. The C++ types stay inside the C++ ABI; only POD structs and
// opaque handles cross the boundary.
//
// Memory model for variable-length outputs: functions that return arrays
// return an `asf32_array` / `asi64_array` / `as_bytes` whose `data` is
// malloc'd by the C++ side. The caller MUST release it with the matching
// `*_free` function. Composite structs (e.g. `as_spectrum`) own several
// arrays and are released with a single `*_free` call. A returned array with
// `data == NULL && len == 0` is a valid empty result (free is a no-op).

#pragma once

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ------------------------------------------------------------------ */
/* Primitive array handles (malloc'd by C++, freed by the matching free fn) */
/* ------------------------------------------------------------------ */

typedef struct {
    float   *data;
    size_t   len;
} asf32_array;

typedef struct {
    int64_t *data;
    size_t   len;
} asi64_array;

typedef struct {
    uint8_t *data;
    size_t   len;
} as_bytes;

void asf32_array_free(asf32_array a);
void asi64_array_free(asi64_array a);
void as_bytes_free(as_bytes b);

/* ------------------------------------------------------------------ */
/* FFT processor (opaque, stateful — reuse across calls)               */
/* ------------------------------------------------------------------ */

typedef struct audioscope_fft AudioscopeFft;

AudioscopeFft *as_fft_new(void);
void           as_fft_free(AudioscopeFft *fft);

/* Window type enum — matches audioscope::common::WindowType ordering. */
typedef enum {
    AS_WINDOW_RECTANGULAR = 0,
    AS_WINDOW_HANN        = 1,
    AS_WINDOW_HAMMING     = 2,
    AS_WINDOW_BLACKMAN    = 3,
} as_window_type;

/* compute_magnitudes — Hann-windowed, returns dB magnitudes (half spectrum). */
asf32_array as_fft_compute_magnitudes(AudioscopeFft *fft,
                                      const float *samples, size_t count,
                                      float sample_rate);

/* find_peak_frequency — returns 1 on success and writes out_freq/out_mag,
 * 0 when the input is empty. min/max_freq bound the search. */
int as_fft_find_peak_frequency(AudioscopeFft *fft,
                               const float *samples, size_t count,
                               float sample_rate, float min_freq, float max_freq,
                               float *out_freq, float *out_mag);

/* compute_spectrum — full spectrum (freqs + dB + phase + peak). */
typedef struct {
    asf32_array frequencies;
    asf32_array magnitudes_db;
    asf32_array phases;          /* empty (len 0) when not computed */
    float       peak_frequency;
    float       peak_magnitude_db;
    float       sample_rate;
    int         window_size;     /* input frame count */
    int         has_phases;      /* 1 when phases array is populated */
} as_spectrum;

as_spectrum as_fft_compute_spectrum(AudioscopeFft *fft,
                                    const float *samples, size_t count,
                                    float sample_rate, as_window_type window);
void as_spectrum_free(as_spectrum *s);

/* ------------------------------------------------------------------ */
/* Time-domain measurements                                            */
/* ------------------------------------------------------------------ */

typedef struct {
    float peak_amplitude;
    float negative_peak_amplitude;
    float rms_amplitude;
    float dc_offset;
    float crest_factor;
    float zero_crossing_rate;
    float dominant_frequency;
    float thd;                   /* 0..1 (fraction, not percent) */
    float snr;                   /* dB */
} as_waveform_analysis;

as_waveform_analysis as_analyze_waveform(const float *samples, size_t count,
                                         float sample_rate);

float as_find_peak_amplitude(const float *samples, size_t count);
float as_find_negative_peak_amplitude(const float *samples, size_t count);
float as_compute_rms(const float *samples, size_t count);
float as_compute_dc_offset(const float *samples, size_t count);
float as_zero_crossing_rate(const float *samples, size_t count);
float as_estimate_dominant_frequency(const float *samples, size_t count,
                                      float sample_rate);

/* dB conversions (parity with Rust measurements.rs). */
float as_amplitude_to_db(float amplitude);
float as_db_to_amplitude(float db);
float as_peak_to_dbfs(float peak_amplitude);
float as_rms_to_dbfs(float rms_amplitude);
float as_dbfs_to_amplitude(float dbfs);
float as_crest_factor_db(float crest_factor);
float as_snr_to_db(float signal_amplitude, float noise_amplitude);

/* ------------------------------------------------------------------ */
/* Harmonic analysis                                                   */
/* ------------------------------------------------------------------ */

typedef struct {
    float frequency;
    float magnitude;
    uint32_t harmonic;           /* 1 = fundamental */
    float phase;
} as_frequency_component;

typedef struct {
    as_frequency_component fundamental;
    asf32_array             harmonics_flat; /* N * sizeof(as_frequency_component) */
    float                   thd;            /* 0..1 */
    float                   thdn;           /* 0..1 */
    float                   signal_energy;
    float                   noise_energy;
} as_harmonic_analysis;

as_harmonic_analysis as_analyze_harmonics(const float *samples, size_t count,
                                          float sample_rate);
void as_harmonic_analysis_free(as_harmonic_analysis *h);

/* ------------------------------------------------------------------ */
/* Spectrogram (STFT)                                                  */
/* ------------------------------------------------------------------ */

typedef struct {
    int    window_size;
    int    overlap;
    float  min_freq;
    float  max_freq;
} as_spectrogram_config;

typedef struct {
    asf32_array frequencies;           /* per freq bin */
    asi64_array time_bins;             /* per time slice (ms) */
    /* magnitudes: row-major, time-major outer, freq inner.
     * rows = time_bins.len, cols = frequencies.len.
     * Stored as a flat array of rows, each row an asf32_array. */
    asf32_array *magnitude_rows;
    size_t       num_rows;
    float        sample_rate;
    int          window_size;
    int          overlap;
} as_spectrogram_data;

as_spectrogram_data as_spectrogram_compute(const float *samples, size_t count,
                                           float sample_rate,
                                           as_spectrogram_config config,
                                           int64_t start_time_ms);
void as_spectrogram_free(as_spectrogram_data *s);

/* ------------------------------------------------------------------ */
/* Compression (LZ4)                                                  */
/* ------------------------------------------------------------------ */

typedef struct {
    as_bytes data;
    size_t   sample_count;
    size_t   original_size;
    size_t   compressed_size;
} as_compressed_waveform;

as_compressed_waveform as_compress_waveform(const float *samples, size_t count);
/* Returns 1 on success (fills `out`), 0 on decode error / size mismatch. */
int as_decompress_waveform(const uint8_t *data, size_t size,
                           size_t sample_count, asf32_array *out);
void as_compressed_waveform_free(as_compressed_waveform *c);

/* ------------------------------------------------------------------ */
/* Trigger detection                                                   */
/* ------------------------------------------------------------------ */

typedef enum {
    AS_TRIGGER_RISING  = 0,
    AS_TRIGGER_FALLING = 1,
    AS_TRIGGER_AUTO    = 2,
} as_trigger_edge;

typedef struct {
    as_trigger_edge edge;     /* AS_TRIGGER_* */
    float            level;
    float            hysteresis;
    int64_t          holdoff;  /* samples to skip at the start */
} as_trigger_options;

typedef struct {
    int  index;                /* -1 = no trigger found */
    int  armed;                /* 1 when armed */
} as_trigger_result;

/* find_trigger — parity with the live TS `findTriggerIndex` path. */
as_trigger_result as_find_trigger(const float *data, size_t count,
                                  as_trigger_options opts);

/* triggered_window — align a frame on the trigger, return window_size samples.
 * Returns a malloc'd asf32_array (empty when no trigger fires). */
asf32_array as_triggered_window(const float *data, size_t count,
                                size_t window_size, as_trigger_options opts);

/* resample_to — nearest-neighbor resample to exactly `points` samples. */
asf32_array as_resample_to(const float *data, size_t count, int points);

/* ------------------------------------------------------------------ */
/* Waveform generators                                                */
/* ------------------------------------------------------------------ */

typedef enum {
    AS_GEN_SINE     = 0,
    AS_GEN_SQUARE   = 1,
    AS_GEN_SAWTOOTH = 2,
    AS_GEN_TRIANGLE = 3,
    AS_GEN_NOISE    = 4,
} as_generator_kind;

typedef enum {
    AS_NOISE_WHITE = 0,
    AS_NOISE_PINK  = 1,
    AS_NOISE_BROWN = 2,
} as_noise_type;

/* generate_waveform — synthesize `num_samples` at `sample_rate`. Returns a
 * malloc'd asf32_array. `frequency` is ignored for noise kinds. */
asf32_array as_generate_waveform(as_generator_kind kind, double frequency,
                                 float amplitude, as_noise_type noise,
                                 double sample_rate, size_t num_samples);

/* ------------------------------------------------------------------ */
/* Version / build info                                                */
/* ------------------------------------------------------------------ */
const char *as_dsp_version(void);

#ifdef __cplusplus
} /* extern "C" */
#endif
