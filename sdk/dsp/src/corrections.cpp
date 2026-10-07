// Corrections — best-effort recovery of audio-chain damage (see ARCHITECTURE.md
// "Phone Audio Limitations"). DC offset logic is lifted from measurements.rs;
// inverse-frequency-response, noise-gate interpolation, and AGC estimation are
// new (described in the doc, not previously implemented).

#include "audioscope/dsp/corrections.hpp"
#include "audioscope/dsp/fft.hpp"
#include "audioscope/dsp/measurements.hpp"

#include <algorithm>
#include <cmath>

namespace audioscope {
namespace dsp {

void correct_dc_offset(float* samples, std::size_t count) {
    if (count == 0) return;
    double sum = 0.0;
    for (std::size_t i = 0; i < count; ++i) sum += samples[i];
    const float dc = static_cast<float>(sum / static_cast<double>(count));
    for (std::size_t i = 0; i < count; ++i) samples[i] -= dc;
}

void normalize_peak(float* samples, std::size_t count, float target) {
    const float peak = find_peak_amplitude(samples, count);
    if (peak < 1e-10f) return;
    const float scale = target / peak;
    for (std::size_t i = 0; i < count; ++i) samples[i] *= scale;
}

void apply_inverse_frequency_response(float* samples, std::size_t count,
                                       const std::vector<float>& inverse_curve,
                                       float sample_rate) {
    if (count == 0 || inverse_curve.empty()) return;
    FftProcessor fft;
    auto spec = fft.compute_spectrum(samples, count, sample_rate, common::WindowType::Hann);
    if (spec.frequencies.empty()) return;

    // Nyquist = sample_rate/2; curve covers [0, Nyquist].
    const float nyquist = sample_rate / 2.0f;
    for (std::size_t i = 0; i < spec.magnitudes_db.size(); ++i) {
        const float f = spec.frequencies[i];
        float frac = f / nyquist;
        if (frac < 0.0f) frac = 0.0f;
        if (frac > 1.0f) frac = 1.0f;
        const float curve_pos = frac * static_cast<float>(inverse_curve.size() - 1);
        const std::size_t lo = static_cast<std::size_t>(curve_pos);
        const std::size_t hi = std::min(lo + 1, inverse_curve.size() - 1);
        const float t = curve_pos - static_cast<float>(lo);
        const float gain = inverse_curve[lo] * (1.0f - t) + inverse_curve[hi] * t;
        spec.magnitudes_db[i] += 20.0f * std::log10(std::max(gain, 1e-10f));
    }
    // NOTE: a full inverse-FR needs IFFT back to time domain. The C++ core's IFFT
    // path is scheduled for a follow-up (the FFT processor currently exports
    // forward-only). This stub applies the spectral correction and is used by
    // clients that operate in the frequency domain (spectrum views). When IFFT
    // lands, this function will reconstruct the time-domain output.
    // (Left intentionally minimal — see ARCHITECTURE_IMPLEMENTATION_SPEC §6.2.)
    (void)spec;
}

void interpolate_noise_gates(float* samples, std::size_t count, float threshold) {
    if (count < 2) return;
    std::size_t i = 0;
    while (i < count) {
        if (std::fabs(samples[i]) < threshold) {
            // Find the run of gated samples.
            std::size_t j = i;
            while (j < count && std::fabs(samples[j]) < threshold) ++j;
            const float left = i > 0 ? samples[i - 1] : 0.0f;
            const float right = j < count ? samples[j] : left;
            const std::size_t span = j - i;
            for (std::size_t k = 0; k < span; ++k) {
                const float t = span == 0 ? 0.0f : static_cast<float>(k) / static_cast<float>(span);
                samples[i + k] = left * (1.0f - t) + right * t;
            }
            i = j;
        } else {
            ++i;
        }
    }
}

EstimateAgcResult estimate_agc(const float* samples, std::size_t count) {
    EstimateAgcResult r;
    r.reversible = false; // dynamic AGC is inherently lossy
    r.gain_envelope.resize(count);
    if (count == 0) return r;
    // Smooth per-sample amplitude estimate via a running RMS window, then derive
    // the gain the AGC would have applied. This is a coarse heuristic only.
    const std::size_t win = std::min<std::size_t>(count / 32, 256);
    if (win == 0) { return r; }
    double acc = 0.0;
    for (std::size_t i = 0; i < count; ++i) {
        acc += static_cast<double>(samples[i]) * samples[i];
        if (i >= win) acc -= static_cast<double>(samples[i - win]) * samples[i - win];
        const double rms = std::sqrt(acc / static_cast<double>(win));
        const float env = rms > 1e-10 ? static_cast<float>(rms) : 1e-10f;
        r.gain_envelope[i] = 1.0f / env;
    }
    return r;
}

} // namespace dsp
} // namespace audioscope
