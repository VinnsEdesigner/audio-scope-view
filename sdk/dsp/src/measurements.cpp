// Measurements — ported from rust/src/domain/measurements.rs.
// Standardized on the harmonic-analysis THD (see ARCHITECTURE_IMPLEMENTATION_SPEC §6.2):
// `estimate_thd_snr` is kept as the fast-path alias from Rust, `analyze_harmonics`
// is the full FFT-based path. Both return the same `analyze_waveform` callsite.

#include "audioscope/dsp/measurements.hpp"
#include "audioscope/dsp/fft.hpp"

#include <algorithm>
#include <cmath>
#include <limits>

namespace audioscope {
namespace dsp {

float find_peak_amplitude(const float* samples, std::size_t count) {
    float max = 0.0f;
    for (std::size_t i = 0; i < count; ++i) {
        const float a = std::fabs(samples[i]);
        if (a > max) max = a;
    }
    return max;
}

float find_negative_peak_amplitude(const float* samples, std::size_t count) {
    float min = 0.0f;
    for (std::size_t i = 0; i < count; ++i) {
        if (samples[i] < min) min = samples[i];
    }
    return min;
}

float compute_rms(const float* samples, std::size_t count) {
    if (count == 0) return 0.0f;
    double sum = 0.0;
    for (std::size_t i = 0; i < count; ++i) sum += static_cast<double>(samples[i]) * samples[i];
    const double mean_square = sum / static_cast<double>(count);
    return static_cast<float>(std::sqrt(mean_square));
}

float compute_dc_offset(const float* samples, std::size_t count) {
    if (count == 0) return 0.0f;
    double sum = 0.0;
    for (std::size_t i = 0; i < count; ++i) sum += samples[i];
    return static_cast<float>(sum / static_cast<double>(count));
}

float zero_crossing_rate(const float* samples, std::size_t count) {
    if (count < 2) return 0.0f;
    std::uint32_t crossings = 0;
    for (std::size_t i = 1; i < count; ++i) {
        const bool prev_neg = samples[i - 1] < 0.0f;
        const bool cur_neg = samples[i] < 0.0f;
        if (prev_neg != cur_neg) ++crossings;
        // Rust uses `(samples[i-1] >= 0.0) != (samples[i] >= 0.0)` — equivalent
        // for non-zero samples; the `<0` form avoids the signed-zero edge.
    }
    return static_cast<float>(crossings) / static_cast<float>(count - 1);
}

float estimate_dominant_frequency(const float* samples, std::size_t count, float sample_rate) {
    const float zcr = zero_crossing_rate(samples, count);
    const float freq = zcr * sample_rate / 2.0f;
    if (freq < 20.0f) return 20.0f;
    if (freq > sample_rate / 2.0f) return sample_rate / 2.0f;
    return freq;
}

namespace {
float compute_harmonic_ratio(const float* samples, std::size_t count) {
    if (count == 0) return 0.0f;
    const float mean = compute_dc_offset(samples, count);
    double variance = 0.0;
    for (std::size_t i = 0; i < count; ++i) {
        const float d = samples[i] - mean;
        variance += static_cast<double>(d) * d;
    }
    variance /= static_cast<double>(count);
    if (variance < 1e-10) return 1.0f;
    const float zcr = zero_crossing_rate(samples, count);
    const float flatness = std::min(zcr * 10.0f, 1.0f);
    float r = 1.0f - flatness;
    if (r < 0.0f) r = 0.0f;
    if (r > 1.0f) r = 1.0f;
    return r;
}
} // namespace

void estimate_thd_snr(const float* samples, std::size_t count, float /*rms*/,
                      float& out_thd_percent, float& out_snr_db) {
    if (count == 0) {
        out_thd_percent = 0.0f;
        out_snr_db = 100.0f;
        return;
    }
    const float dc = compute_dc_offset(samples, count);
    std::vector<float> centered(count);
    for (std::size_t i = 0; i < count; ++i) centered[i] = samples[i] - dc;
    const float peak = find_peak_amplitude(centered.data(), count);
    if (peak < 1e-10f) {
        out_thd_percent = 0.0f;
        out_snr_db = 100.0f;
        return;
    }
    const float harmonic_ratio = compute_harmonic_ratio(centered.data(), count);
    float thd = 1.0f - harmonic_ratio;
    if (thd < 0.0f) thd = 0.0f;
    if (thd > 1.0f) thd = 1.0f;
    float snr = 0.0f;
    if (harmonic_ratio > 0.0f) {
        snr = 20.0f * std::log10(harmonic_ratio / (1.0f - harmonic_ratio + 1e-10f));
    }
    if (snr < 0.0f) snr = 0.0f;
    if (snr > 120.0f) snr = 120.0f;
    out_thd_percent = thd * 100.0f;
    out_snr_db = snr;
}

WaveformAnalysis analyze_waveform(const float* samples, std::size_t count, float sample_rate) {
    WaveformAnalysis a;
    if (count == 0) return a;
    a.peak_amplitude = find_peak_amplitude(samples, count);
    a.negative_peak_amplitude = find_negative_peak_amplitude(samples, count);
    a.rms = compute_rms(samples, count);
    a.dc_offset = compute_dc_offset(samples, count);
    a.crest_factor = a.rms > 0.0f ? a.peak_amplitude / a.rms : 0.0f;
    a.zero_crossing_rate = zero_crossing_rate(samples, count);
    a.dominant_frequency = estimate_dominant_frequency(samples, count, sample_rate);
    estimate_thd_snr(samples, count, a.rms, a.thd_percent, a.snr_db);
    return a;
}

HarmonicAnalysis analyze_harmonics(const float* samples, std::size_t count, float sample_rate) {
    HarmonicAnalysis ha;
    if (count == 0) return ha;
    FftProcessor fft;
    const Spectrum spec = fft.compute_spectrum(samples, count, sample_rate,
                                               common::WindowType::Hann);
    if (spec.frequencies.empty()) return ha;

    float max_mag = -1e30f;
    std::size_t peak_idx = 0;
    for (std::size_t i = 0; i < spec.magnitudes_db.size(); ++i) {
        if (spec.magnitudes_db[i] > max_mag && spec.frequencies[i] > 20.0f) {
            max_mag = spec.magnitudes_db[i];
            peak_idx = i;
        }
    }
    const float fundamental_freq = spec.frequencies[peak_idx];
    const float fundamental_mag = max_mag;

    ha.fundamental = FrequencyComponent{fundamental_freq, fundamental_mag, 1, 0.0f};

    float harmonic_energies = 0.0f;
    double total_energy = 0.0;
    for (float db : spec.magnitudes_db) {
        const float lin = std::pow(10.0f, db / 10.0f);
        total_energy += static_cast<double>(lin) * lin;
    }

    if (spec.frequencies.size() > 1) {
        const float freq_res = spec.frequencies[1];
        for (std::uint32_t h = 2; h <= 10; ++h) {
            const float harmonic_freq = fundamental_freq * static_cast<float>(h);
            const std::size_t bin_idx = static_cast<std::size_t>(harmonic_freq / freq_res);
            if (bin_idx < spec.magnitudes_db.size()) {
                const float mag = spec.magnitudes_db[bin_idx];
                harmonic_energies += std::pow(10.0f, mag / 10.0f);
                ha.harmonics.push_back(
                    FrequencyComponent{harmonic_freq, mag, h, 0.0f});
            }
        }
    }

    ha.signal_energy = std::pow(10.0f, fundamental_mag / 10.0f);
    const float noise = static_cast<float>(total_energy) - ha.signal_energy - harmonic_energies;
    ha.noise_energy = noise > 0.0f ? noise : 0.0f;
    ha.thd = (ha.signal_energy + harmonic_energies) > 0.0f
                 ? harmonic_energies / (ha.signal_energy + harmonic_energies)
                 : 0.0f;
    ha.thdn = ha.signal_energy > 0.0f
                  ? (harmonic_energies + ha.noise_energy) / ha.signal_energy
                  : 0.0f;
    return ha;
}

// dB conversions — parity with measurements.rs.
float amplitude_to_db(float amplitude) {
    if (amplitude <= 0.0f) return -std::numeric_limits<float>::infinity();
    return 20.0f * std::log10(amplitude);
}
float db_to_amplitude(float db) {
    if (db == -std::numeric_limits<float>::infinity()) return 0.0f;
    return std::pow(10.0f, db / 20.0f);
}
float peak_to_dbfs(float peak_amplitude) {
    if (peak_amplitude <= 0.0f) return -std::numeric_limits<float>::infinity();
    return 20.0f * std::log10(peak_amplitude);
}
float rms_to_dbfs(float rms_amplitude) {
    if (rms_amplitude <= 0.0f) return -std::numeric_limits<float>::infinity();
    return 20.0f * std::log10(rms_amplitude);
}
float dbfs_to_amplitude(float dbfs) { return db_to_amplitude(dbfs); }
float crest_factor_db(float crest_factor) {
    if (crest_factor <= 0.0f) return -std::numeric_limits<float>::infinity();
    return 20.0f * std::log10(crest_factor);
}
float snr_to_db(float signal_amplitude, float noise_amplitude) {
    if (signal_amplitude <= 0.0f || noise_amplitude <= 0.0f) return 0.0f;
    return 20.0f * std::log10(signal_amplitude / noise_amplitude);
}

} // namespace dsp
} // namespace audioscope
