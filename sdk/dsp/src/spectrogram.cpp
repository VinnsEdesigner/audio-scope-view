// Spectrogram — ported from rust/src/domain/spectrogram.rs.
// Adapted to take raw float samples + a start timestamp (the Rust version took
// a `Waveform` entity; the C++ core is agnostic to the storage entity).

#include "audioscope/dsp/spectrogram.hpp"
#include "audioscope/dsp/fft.hpp"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <memory>

namespace audioscope {
namespace dsp {

SpectrogramConfig SpectrogramConfig::with_window_size(int size) const {
    SpectrogramConfig c = *this;
    c.window_size = size;
    return c;
}
SpectrogramConfig SpectrogramConfig::with_overlap(int ov) const {
    SpectrogramConfig c = *this;
    c.overlap = ov;
    return c;
}
SpectrogramConfig SpectrogramConfig::with_frequency_range(float min, float max) const {
    SpectrogramConfig c = *this;
    c.min_freq = min;
    c.max_freq = max;
    return c;
}

float SpectrogramData::max_magnitude() const {
    float max = -1e30f;
    for (const auto& row : magnitudes) {
        for (float m : row) if (m > max) max = m;
    }
    return max;
}
float SpectrogramData::min_magnitude() const {
    float min = 1e30f;
    for (const auto& row : magnitudes) {
        for (float m : row) if (m < min) min = m;
    }
    return min;
}

std::vector<std::uint8_t> SpectrogramData::to_image_data(int width, int height) const {
    if (magnitudes.empty() || frequencies.empty()) {
        return std::vector<std::uint8_t>(static_cast<std::size_t>(width) * height * 3, 0);
    }
    const float max_mag = max_magnitude();
    const float min_mag = min_magnitude();
    const float range = std::max(max_mag - min_mag, 0.001f);
    const int time_count = static_cast<int>(time_bins.size());
    const int freq_bins = static_cast<int>(frequencies.size());
    std::vector<std::uint8_t> pixels(static_cast<std::size_t>(width) * height * 3);
    for (int y = 0; y < height; ++y) {
        int freq_idx = static_cast<int>(static_cast<float>(y) / height * freq_bins);
        if (freq_idx > freq_bins - 1) freq_idx = freq_bins - 1;
        for (int x = 0; x < width; ++x) {
            int time_idx = static_cast<int>(static_cast<float>(x) / width * time_count);
            if (time_idx > time_count - 1) time_idx = time_count - 1;
            const float mag = magnitudes[time_idx][freq_idx];
            const int v = static_cast<int>((mag - min_mag) / range * 255.0f);
            const std::uint8_t n = v > 255 ? 255 : (v < 0 ? 0 : static_cast<std::uint8_t>(v));
            auto idx = (static_cast<std::size_t>(y) * width + x) * 3;
            pixels[idx] = n;
            pixels[idx + 1] = static_cast<std::uint8_t>(std::max(n - 50, 0));
            pixels[idx + 2] = static_cast<std::uint8_t>(std::max(n - 100, 0));
        }
    }
    return pixels;
}

class SpectrogramProcessor::Impl {
public:
    FftProcessor fft;
};

SpectrogramProcessor::SpectrogramProcessor() : impl_(std::make_unique<Impl>()) {}
SpectrogramProcessor::~SpectrogramProcessor() = default;

SpectrogramData SpectrogramProcessor::compute(const float* samples, std::size_t count,
                                               float sample_rate, const SpectrogramConfig& config,
                                               std::int64_t start_time_ms) {
    SpectrogramData out;
    out.sample_rate = sample_rate;
    out.window_size = config.window_size;
    out.overlap = config.overlap;
    const int hop = config.window_size - config.overlap;
    if (hop <= 0 || count < static_cast<std::size_t>(config.window_size)) {
        return out;
    }
    std::vector<float> frequencies;
    std::vector<std::vector<float>> magnitudes;
    std::vector<std::int64_t> time_bins;
    std::size_t position = 0;
    while (position + config.window_size <= count) {
        const Spectrum spec = impl_->fft.compute_spectrum(
            samples + position, static_cast<std::size_t>(config.window_size),
            sample_rate, common::WindowType::Hann);
        if (spec.frequencies.empty()) {
            position += hop;
            continue;
        }
        std::size_t f_start = 0;
        for (std::size_t i = 0; i < spec.frequencies.size(); ++i) {
            if (spec.frequencies[i] >= config.min_freq) { f_start = i; break; }
        }
        std::size_t f_end = spec.frequencies.size();
        for (std::size_t i = spec.frequencies.size(); i-- > 0;) {
            if (spec.frequencies[i] <= config.max_freq) { f_end = i + 1; break; }
        }
        std::vector<float> filtered(spec.magnitudes_db.begin() + f_start,
                                    spec.magnitudes_db.begin() + f_end);
        if (frequencies.empty()) {
            frequencies.assign(spec.frequencies.begin() + f_start,
                               spec.frequencies.begin() + f_end);
        }
        const std::int64_t ts = start_time_ms
            + static_cast<std::int64_t>(position) * 1000 / static_cast<std::int64_t>(sample_rate);
        time_bins.push_back(ts);
        magnitudes.push_back(std::move(filtered));
        position += hop;
    }
    out.frequencies = std::move(frequencies);
    out.time_bins = std::move(time_bins);
    out.magnitudes = std::move(magnitudes);
    return out;
}

SpectrogramData SpectrogramProcessor::compute_default(const float* samples, std::size_t count,
                                                       float sample_rate) {
    return compute(samples, count, sample_rate, SpectrogramConfig{});
}

} // namespace dsp
} // namespace audioscope
