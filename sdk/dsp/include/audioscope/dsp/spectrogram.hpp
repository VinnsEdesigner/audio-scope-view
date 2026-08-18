#pragma once

#include <cstdint>
#include <memory>
#include <vector>

namespace audioscope {
namespace dsp {

/// Spectrogram (STFT) configuration. Mirrors Rust `SpectrogramConfig`.
struct SpectrogramConfig {
    int window_size = 1024;
    int overlap = 512;
    float min_freq = 0.0f;
    float max_freq = 22050.0f;

    SpectrogramConfig with_window_size(int size) const;
    SpectrogramConfig with_overlap(int ov) const;
    SpectrogramConfig with_frequency_range(float min, float max) const;
};

/// Spectrogram data: row-major magnitudes (time-major outer, freq inner).
/// Mirrors Rust `SpectrogramData`.
struct SpectrogramData {
    std::vector<float> frequencies;     // Hz per freq bin
    std::vector<std::int64_t> time_bins; // ms per time slice
    std::vector<std::vector<float>> magnitudes;  // [time][freq] dB
    float sample_rate = 44100.0f;
    int window_size = 1024;
    int overlap = 512;

    bool empty() const { return magnitudes.empty(); }

    float max_magnitude() const;
    float min_magnitude() const;

    /// Render to a width×height RGB image (row-major, 3 bytes/pixel).
    /// Blue→green→red colormap by magnitude.
    std::vector<std::uint8_t> to_image_data(int width, int height) const;
};

/// STFT spectrogram processor. Owns an FftProcessor.
class SpectrogramProcessor {
public:
    SpectrogramProcessor();
    ~SpectrogramProcessor();
    SpectrogramProcessor(const SpectrogramProcessor&) = delete;
    SpectrogramProcessor& operator=(const SpectrogramProcessor&) = delete;

    /// Compute a spectrogram from `samples` (float32, mono).
    /// `start_time_ms` is the absolute timestamp of sample 0.
    SpectrogramData compute(const float* samples, std::size_t count,
                            float sample_rate, const SpectrogramConfig& config,
                            std::int64_t start_time_ms = 0);

    SpectrogramData compute_default(const float* samples, std::size_t count,
                                    float sample_rate);

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace dsp
} // namespace audioscope
