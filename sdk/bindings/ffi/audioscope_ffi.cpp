// audioscope_ffi.cpp — C ABI implementation over the C++ DSP core.
//
// Every function here is a thin adapter: it calls the C++ class, copies the
// result into a malloc'd C buffer, and returns the POD handle. The host
// language (Rust/WASM/JNI) owns the copy and frees it with the matching free
// function. No C++ objects cross the boundary — only opaque handles + POD.

#include "audioscope_ffi.h"

#include "audioscope/dsp/fft.hpp"
#include "audioscope/dsp/measurements.hpp"
#include "audioscope/dsp/spectrogram.hpp"
#include "audioscope/dsp/compression.hpp"
#include "audioscope/common/config.hpp"

#include <cstdlib>
#include <cstring>
#include <new>
#include <string>
#include <vector>

// --------------------------------------------------------------------- //
// Internal helpers
// --------------------------------------------------------------------- //

namespace {
// malloc a C buffer and copy a std::vector<T> into it. Returns an empty
// (data=null, len=0) array when the input is empty or malloc fails.
template <typename OutT, typename InT>
asf32_array copy_f32_to_c(const std::vector<InT>& in) {
    asf32_array a{nullptr, 0};
    if (in.empty()) return a;
    a.data = static_cast<float*>(std::malloc(in.size() * sizeof(float)));
    if (!a.data) return a;
    for (size_t i = 0; i < in.size(); ++i) a.data[i] = static_cast<float>(in[i]);
    a.len = in.size();
    return a;
}

asf32_array copy_f32_to_c(const std::vector<float>& in) {
    asf32_array a{nullptr, 0};
    if (in.empty()) return a;
    a.data = static_cast<float*>(std::malloc(in.size() * sizeof(float)));
    if (!a.data) return a;
    std::memcpy(a.data, in.data(), in.size() * sizeof(float));
    a.len = in.size();
    return a;
}

asi64_array copy_i64_to_c(const std::vector<int64_t>& in) {
    asi64_array a{nullptr, 0};
    if (in.empty()) return a;
    a.data = static_cast<int64_t*>(std::malloc(in.size() * sizeof(int64_t)));
    if (!a.data) return a;
    std::memcpy(a.data, in.data(), in.size() * sizeof(int64_t));
    a.len = in.size();
    return a;
}

as_bytes copy_bytes_to_c(const std::vector<uint8_t>& in) {
    as_bytes b{nullptr, 0};
    if (in.empty()) return b;
    b.data = static_cast<uint8_t*>(std::malloc(in.size()));
    if (!b.data) return b;
    std::memcpy(b.data, in.data(), in.size());
    b.len = in.size();
    return b;
}

audioscope::common::WindowType to_cpp_window(as_window_type w) {
    switch (w) {
        case AS_WINDOW_RECTANGULAR: return audioscope::common::WindowType::Rectangular;
        case AS_WINDOW_HANN:        return audioscope::common::WindowType::Hann;
        case AS_WINDOW_HAMMING:     return audioscope::common::WindowType::Hamming;
        case AS_WINDOW_BLACKMAN:    return audioscope::common::WindowType::Blackman;
    }
    return audioscope::common::WindowType::Hann;
}
} // namespace

// --------------------------------------------------------------------- //
// Array free functions
// --------------------------------------------------------------------- //

extern "C" {

void asf32_array_free(asf32_array a) { std::free(a.data); }
void asi64_array_free(asi64_array a) { std::free(a.data); }
void as_bytes_free(as_bytes b)       { std::free(b.data); }

// --------------------------------------------------------------------- //
// FFT processor
// --------------------------------------------------------------------- //

struct audioscope_fft {
    audioscope::dsp::FftProcessor proc;
    audioscope_fft() : proc(16384) {}
};

AudioscopeFft *as_fft_new(void) {
    return new (std::nothrow) audioscope_fft();
}

void as_fft_free(AudioscopeFft *fft) { delete fft; }

asf32_array as_fft_compute_magnitudes(AudioscopeFft *fft,
                                      const float *samples, size_t count,
                                      float sample_rate) {
    if (!fft || (!samples && count > 0)) return {nullptr, 0};
    const auto mags = fft->proc.compute_magnitudes(samples, count, sample_rate);
    return copy_f32_to_c(mags);
}

int as_fft_find_peak_frequency(AudioscopeFft *fft,
                               const float *samples, size_t count,
                               float sample_rate, float min_freq, float max_freq,
                               float *out_freq, float *out_mag) {
    if (!fft || count == 0) return 0;
    const float freq = fft->proc.find_peak_frequency(samples, count, sample_rate,
                                                      min_freq, max_freq);
    // The C++ find_peak_frequency returns only the frequency. To preserve the
    // Rust API (which returns (freq, magnitude)) we recompute the magnitude at
    // that bin. This is the same double-work the Rust path does implicitly via
    // its internal compute_magnitudes call.
    if (freq < 0.0f) {
        if (out_freq) *out_freq = 0.0f;
        if (out_mag)  *out_mag = -100.0f;
        return 0;
    }
    const auto mags = fft->proc.compute_magnitudes(samples, count, sample_rate);
    const size_t size = audioscope::dsp::FftProcessor::next_pow_two(count);
    const float freq_res = sample_rate / static_cast<float>(size);
    const size_t bin = static_cast<size_t>(freq / freq_res);
    float mag = -100.0f;
    if (bin < mags.size()) mag = mags[bin];
    if (out_freq) *out_freq = freq;
    if (out_mag)  *out_mag = mag;
    return 1;
}

as_spectrum as_fft_compute_spectrum(AudioscopeFft *fft,
                                    const float *samples, size_t count,
                                    float sample_rate, as_window_type window) {
    as_spectrum s{};
    s.has_phases = 0;
    if (!fft || (!samples && count > 0)) return s;
    const auto spec = fft->proc.compute_spectrum(samples, count, sample_rate,
                                                  to_cpp_window(window));
    s.frequencies       = copy_f32_to_c(spec.frequencies);
    s.magnitudes_db     = copy_f32_to_c(spec.magnitudes_db);
    s.phases            = copy_f32_to_c(spec.phases);
    s.has_phases        = !spec.phases.empty() ? 1 : 0;
    s.peak_frequency    = spec.peak_frequency;
    s.peak_magnitude_db = spec.peak_magnitude_db;
    s.sample_rate       = spec.sample_rate;
    s.window_size       = spec.window_size;
    return s;
}

void as_spectrum_free(as_spectrum *s) {
    if (!s) return;
    asf32_array_free(s->frequencies);
    asf32_array_free(s->magnitudes_db);
    asf32_array_free(s->phases);
    std::memset(s, 0, sizeof(*s));
}

// --------------------------------------------------------------------- //
// Measurements
// --------------------------------------------------------------------- //

as_waveform_analysis as_analyze_waveform(const float *samples, size_t count,
                                         float sample_rate) {
    as_waveform_analysis r{};
    if (!samples && count > 0) return r;
    const auto a = audioscope::dsp::analyze_waveform(samples, count, sample_rate);
    r.peak_amplitude          = a.peak_amplitude;
    r.negative_peak_amplitude = a.negative_peak_amplitude;
    r.rms_amplitude           = a.rms;
    r.dc_offset               = a.dc_offset;
    r.crest_factor            = a.crest_factor;
    r.zero_crossing_rate      = a.zero_crossing_rate;
    r.dominant_frequency      = a.dominant_frequency;
    r.thd                     = a.thd_percent / 100.0f;  /* C++ percent → Rust fraction */
    r.snr                     = a.snr_db;
    return r;
}

float as_find_peak_amplitude(const float *samples, size_t count) {
    if (!samples && count > 0) return 0.0f;
    return audioscope::dsp::find_peak_amplitude(samples, count);
}
float as_find_negative_peak_amplitude(const float *samples, size_t count) {
    if (!samples && count > 0) return 0.0f;
    return audioscope::dsp::find_negative_peak_amplitude(samples, count);
}
float as_compute_rms(const float *samples, size_t count) {
    if (!samples && count > 0) return 0.0f;
    return audioscope::dsp::compute_rms(samples, count);
}
float as_compute_dc_offset(const float *samples, size_t count) {
    if (!samples && count > 0) return 0.0f;
    return audioscope::dsp::compute_dc_offset(samples, count);
}
float as_zero_crossing_rate(const float *samples, size_t count) {
    if (!samples && count > 0) return 0.0f;
    return audioscope::dsp::zero_crossing_rate(samples, count);
}
float as_estimate_dominant_frequency(const float *samples, size_t count, float sample_rate) {
    if (!samples && count > 0) return 0.0f;
    return audioscope::dsp::estimate_dominant_frequency(samples, count, sample_rate);
}

float as_amplitude_to_db(float a)        { return audioscope::dsp::amplitude_to_db(a); }
float as_db_to_amplitude(float db)       { return audioscope::dsp::db_to_amplitude(db); }
float as_peak_to_dbfs(float p)           { return audioscope::dsp::peak_to_dbfs(p); }
float as_rms_to_dbfs(float r)            { return audioscope::dsp::rms_to_dbfs(r); }
float as_dbfs_to_amplitude(float dbfs)   { return audioscope::dsp::dbfs_to_amplitude(dbfs); }
float as_crest_factor_db(float cf)       { return audioscope::dsp::crest_factor_db(cf); }
float as_snr_to_db(float s, float n)     { return audioscope::dsp::snr_to_db(s, n); }

// --------------------------------------------------------------------- //
// Harmonic analysis
// --------------------------------------------------------------------- //

as_harmonic_analysis as_analyze_harmonics(const float *samples, size_t count,
                                          float sample_rate) {
    as_harmonic_analysis r{};
    if (!samples && count > 0) return r;
    const auto ha = audioscope::dsp::analyze_harmonics(samples, count, sample_rate);
    r.fundamental.frequency = ha.fundamental.frequency;
    r.fundamental.magnitude = ha.fundamental.magnitude;
    r.fundamental.harmonic  = ha.fundamental.harmonic;
    r.fundamental.phase     = ha.fundamental.phase;
    // Pack harmonics into a flat byte array of as_frequency_component structs.
    if (!ha.harmonics.empty()) {
        const size_t bytes = ha.harmonics.size() * sizeof(as_frequency_component);
        r.harmonics_flat.data = static_cast<float*>(std::malloc(bytes));
        if (r.harmonics_flat.data) {
            std::memcpy(r.harmonics_flat.data, ha.harmonics.data(), bytes);
            r.harmonics_flat.len = ha.harmonics.size() * sizeof(as_frequency_component) / sizeof(float);
        }
    }
    r.thd           = ha.thd;
    r.thdn          = ha.thdn;
    r.signal_energy = ha.signal_energy;
    r.noise_energy  = ha.noise_energy;
    return r;
}

void as_harmonic_analysis_free(as_harmonic_analysis *h) {
    if (!h) return;
    asf32_array_free(h->harmonics_flat);
    std::memset(h, 0, sizeof(*h));
}

// --------------------------------------------------------------------- //
// Spectrogram
// --------------------------------------------------------------------- //

as_spectrogram_data as_spectrogram_compute(const float *samples, size_t count,
                                           float sample_rate,
                                           as_spectrogram_config config,
                                           int64_t start_time_ms) {
    as_spectrogram_data out{};
    if (!samples && count > 0) return out;
    audioscope::dsp::SpectrogramProcessor sp;
    audioscope::dsp::SpectrogramConfig cfg;
    cfg.window_size = config.window_size;
    cfg.overlap     = config.overlap;
    cfg.min_freq    = config.min_freq;
    cfg.max_freq    = config.max_freq;
    const auto data = sp.compute(samples, count, sample_rate, cfg, start_time_ms);
    out.frequencies = copy_f32_to_c(data.frequencies);
    out.time_bins   = copy_i64_to_c(data.time_bins);
    out.sample_rate = data.sample_rate;
    out.window_size = data.window_size;
    out.overlap     = data.overlap;
    if (!data.magnitudes.empty()) {
        out.magnitude_rows = static_cast<asf32_array*>(
            std::calloc(data.magnitudes.size(), sizeof(asf32_array)));
        if (out.magnitude_rows) {
            out.num_rows = data.magnitudes.size();
            for (size_t i = 0; i < data.magnitudes.size(); ++i) {
                out.magnitude_rows[i] = copy_f32_to_c(data.magnitudes[i]);
            }
        }
    }
    return out;
}

void as_spectrogram_free(as_spectrogram_data *s) {
    if (!s) return;
    asf32_array_free(s->frequencies);
    asi64_array_free(s->time_bins);
    if (s->magnitude_rows) {
        for (size_t i = 0; i < s->num_rows; ++i) asf32_array_free(s->magnitude_rows[i]);
        std::free(s->magnitude_rows);
    }
    std::memset(s, 0, sizeof(*s));
}

// --------------------------------------------------------------------- //
// Compression
// --------------------------------------------------------------------- //

as_compressed_waveform as_compress_waveform(const float *samples, size_t count) {
    as_compressed_waveform r{};
    if (!samples && count > 0) return r;
    const auto cw = audioscope::dsp::compress_waveform(samples, count);
    r.data            = copy_bytes_to_c(cw.data);
    r.sample_count    = cw.sample_count;
    r.original_size   = cw.original_size;
    r.compressed_size = cw.compressed_size;
    return r;
}

int as_decompress_waveform(const uint8_t *data, size_t size,
                           size_t sample_count, asf32_array *out) {
    if (!out) return 0;
    out->data = nullptr; out->len = 0;
    if ((!data && size > 0) || sample_count == 0) return 0;
    const auto decoded = audioscope::dsp::decompress_waveform(data, size, sample_count);
    if (decoded.empty()) return 0;
    *out = copy_f32_to_c(decoded);
    return out->data ? 1 : 0;
}

void as_compressed_waveform_free(as_compressed_waveform *c) {
    if (!c) return;
    as_bytes_free(c->data);
    std::memset(c, 0, sizeof(*c));
}

// --------------------------------------------------------------------- //
// Version
// --------------------------------------------------------------------- //

const char *as_dsp_version(void) {
    static const char* v = "audio-scope-view DSP core 1.0.0 (C++ ABI)";
    return v;
}

} // extern "C"
