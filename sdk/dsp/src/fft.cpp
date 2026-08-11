// FFT processor — single radix-2 Cooley-Tukey implementation compiled to all
// targets. Ported from:
//   - apps/vyzorWeb/src/lib/scope-dsp.ts  (in-place radix-2 + Hann window)
//   - rust/src/domain/fft_processor.rs   (Spectrum struct + compute_spectrum)
// The TS radix-2 algorithm is the live one; the Rust `rustfft`-based path is
// retired in favor of this single implementation.

#include "audioscope/dsp/fft.hpp"

#include <cmath>
#include <stdexcept>

namespace audioscope {
namespace dsp {

namespace {
constexpr float PI_F = 3.14159265358979323846f;
} // namespace

std::size_t FftProcessor::next_pow_two(std::size_t v) {
    if (v <= 1) return 1;
    std::size_t p = 1;
    while (p < v) p <<= 1;
    return p;
}

std::vector<float> FftProcessor::apply_window(const float* samples, std::size_t count,
                                              common::WindowType window) {
    std::vector<float> out(count);
    if (count == 0) return out;
    const float n = static_cast<float>(count - 1);
    for (std::size_t i = 0; i < count; ++i) {
        const float idx = static_cast<float>(i);
        float w = 1.0f;
        switch (window) {
            case common::WindowType::Rectangular:
                w = 1.0f;
                break;
            case common::WindowType::Hann:
                w = 0.5f * (1.0f - std::cos(2.0f * PI_F * idx / n));
                break;
            case common::WindowType::Hamming:
                w = 0.54f - 0.46f * std::cos(2.0f * PI_F * idx / n);
                break;
            case common::WindowType::Blackman:
                w = 0.42f - 0.5f * std::cos(2.0f * PI_F * idx / n)
                    + 0.08f * std::cos(4.0f * PI_F * idx / n);
                break;
        }
        out[i] = samples[i] * w;
    }
    return out;
}

FftProcessor::FftProcessor(int max_fft_size)
    : max_fft_size_(max_fft_size > 0 ? max_fft_size : 16384) {
    re_.resize(max_fft_size_);
    im_.resize(max_fft_size_);
}

void FftProcessor::ensure_scratch(std::size_t size) {
    if (size > re_.size()) {
        re_.resize(size);
        im_.resize(size);
    }
}

// In-place iterative radix-2 Cooley-Tukey FFT (forward).
// Parity with scope-dsp.ts `fft(re, im)`.
namespace {
void fft_forward(float* re, float* im, std::size_t n) {
    // Bit-reversal permutation.
    for (std::size_t i = 1, j = 0; i < n; ++i) {
        std::size_t bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            std::swap(re[i], re[j]);
            std::swap(im[i], im[j]);
        }
    }
    // Butterfly stages.
    for (std::size_t len = 2; len <= n; len <<= 1) {
        const float angle = -2.0f * PI_F / static_cast<float>(len);
        const float w_re = std::cos(angle);
        const float w_im = std::sin(angle);
        const std::size_t half = len >> 1;
        for (std::size_t start = 0; start < n; start += len) {
            float cur_re = 1.0f;
            float cur_im = 0.0f;
            for (std::size_t k = 0; k < half; ++k) {
                const float a_re = re[start + k];
                const float a_im = im[start + k];
                const float t_re = re[start + k + half] * cur_re
                                  - im[start + k + half] * cur_im;
                const float t_im = re[start + k + half] * cur_im
                                  + im[start + k + half] * cur_re;
                re[start + k] = a_re + t_re;
                im[start + k] = a_im + t_im;
                re[start + k + half] = a_re - t_re;
                im[start + k + half] = a_im - t_im;
                const float next_re = cur_re * w_re - cur_im * w_im;
                cur_im = cur_re * w_im + cur_im * w_re;
                cur_re = next_re;
            }
        }
    }
}
} // namespace

std::vector<float> FftProcessor::compute_magnitudes(const float* samples, std::size_t count,
                                                    float sample_rate) {
    (void)sample_rate;
    if (count == 0) return {};
    const std::size_t size = FftProcessor::next_pow_two(count);
    ensure_scratch(size);
    for (std::size_t i = 0; i < size; ++i) {
        re_[i] = i < count ? samples[i] : 0.0f;
        im_[i] = 0.0f;
    }
    // Hann window (parity with Rust compute_magnitudes which always uses Hann).
    {
        const float n = static_cast<float>(size - 1);
        for (std::size_t i = 0; i < size; ++i) {
            const float w = 0.5f * (1.0f - std::cos(2.0f * PI_F * static_cast<float>(i) / n));
            re_[i] *= w;
        }
    }
    fft_forward(re_.data(), im_.data(), size);
    const std::size_t half = size / 2;
    std::vector<float> mags(half);
    const float inv_sqrt = 1.0f / std::sqrt(static_cast<float>(size));
    for (std::size_t i = 0; i < half; ++i) {
        const float mag = std::sqrt(re_[i] * re_[i] + im_[i] * im_[i]) * inv_sqrt;
        float db = 20.0f * std::log10(std::max(mag, 1e-10f));
        if (db < -100.0f) db = -100.0f;
        mags[i] = db;
    }
    return mags;
}

Spectrum FftProcessor::compute_spectrum(const float* samples, std::size_t count,
                                        float sample_rate, common::WindowType window) {
    Spectrum s;
    s.sample_rate = sample_rate;
    if (count == 0) return s;

    const std::size_t size = FftProcessor::next_pow_two(count);
    ensure_scratch(size);
    // Window the input (copy + window), zero-pad to size.
    const float wn = static_cast<float>(count - 1);
    for (std::size_t i = 0; i < size; ++i) {
        if (i < count) {
            float w = 1.0f;
            switch (window) {
                case common::WindowType::Rectangular: w = 1.0f; break;
                case common::WindowType::Hann:
                    w = 0.5f * (1.0f - std::cos(2.0f * PI_F * static_cast<float>(i) / wn));
                    break;
                case common::WindowType::Hamming:
                    w = 0.54f - 0.46f * std::cos(2.0f * PI_F * static_cast<float>(i) / wn);
                    break;
                case common::WindowType::Blackman:
                    w = 0.42f - 0.5f * std::cos(2.0f * PI_F * static_cast<float>(i) / wn)
                        + 0.08f * std::cos(4.0f * PI_F * static_cast<float>(i) / wn);
                    break;
            }
            re_[i] = samples[i] * w;
        } else {
            re_[i] = 0.0f;
        }
        im_[i] = 0.0f;
    }

    fft_forward(re_.data(), im_.data(), size);

    const std::size_t half = size / 2;
    const float freq_resolution = sample_rate / static_cast<float>(size);
    const float inv_sqrt = 1.0f / std::sqrt(static_cast<float>(size));

    s.frequencies.resize(half);
    s.magnitudes_db.resize(half);
    s.phases.resize(half);

    float max_db = -1e30f;
    std::size_t peak_bin = 0;
    for (std::size_t i = 0; i < half; ++i) {
        const float freq = static_cast<float>(i) * freq_resolution;
        const float mag = std::sqrt(re_[i] * re_[i] + im_[i] * im_[i]) * inv_sqrt;
        float db = 20.0f * std::log10(std::max(mag, 1e-10f));
        if (db < -100.0f) db = -100.0f;
        const float phase = std::atan2(im_[i], re_[i]);
        s.frequencies[i] = freq;
        s.magnitudes_db[i] = db;
        s.phases[i] = phase;
        if (db > max_db) {
            max_db = db;
            peak_bin = i;
        }
    }
    s.peak_frequency = static_cast<float>(peak_bin) * freq_resolution;
    s.peak_magnitude_db = max_db;
    s.sample_rate = sample_rate;
    s.window_size = static_cast<int>(count);
    return s;
}

float FftProcessor::find_peak_frequency(const float* samples, std::size_t count,
                                        float sample_rate, float min_freq, float max_freq) {
    if (count == 0) return -1.0f;
    const auto mags = compute_magnitudes(samples, count, sample_rate);
    const std::size_t size = FftProcessor::next_pow_two(count);
    const float freq_resolution = sample_rate / static_cast<float>(size);
    const std::size_t min_bin = static_cast<std::size_t>(min_freq / freq_resolution);
    const std::size_t max_bin = static_cast<std::size_t>(max_freq / freq_resolution);
    float max_mag = -1e30f;
    std::size_t peak_bin = 0;
    const std::size_t upper = std::min(max_bin, mags.size());
    for (std::size_t i = min_bin; i < upper; ++i) {
        if (mags[i] > max_mag) {
            max_mag = mags[i];
            peak_bin = i;
        }
    }
    return static_cast<float>(peak_bin) * freq_resolution;
}

std::vector<float> Spectrum::linear_magnitudes() const {
    std::vector<float> out(magnitudes_db.size());
    for (std::size_t i = 0; i < magnitudes_db.size(); ++i) {
        out[i] = std::pow(10.0f, magnitudes_db[i] / 20.0f);
    }
    return out;
}

std::vector<float> Spectrum::normalized_magnitudes() const {
    if (magnitudes_db.empty()) return {};
    const float max_db = peak_magnitude_db;
    const float min_db = -100.0f;
    std::vector<float> out(magnitudes_db.size());
    for (std::size_t i = 0; i < magnitudes_db.size(); ++i) {
        float v = (magnitudes_db[i] - min_db) / (max_db - min_db);
        if (v < 0.0f) v = 0.0f;
        if (v > 1.0f) v = 1.0f;
        out[i] = v;
    }
    return out;
}

} // namespace dsp
} // namespace audioscope
