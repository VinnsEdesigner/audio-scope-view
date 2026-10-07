// Spectrogram tests — verify the STFT produces the right shape for a sine
// input (mirrors the Rust processor's behavior: time slices + freq bins).

#include "audioscope/dsp/spectrogram.hpp"

#include <gtest/gtest.h>
#include <cmath>
#include <vector>

namespace {
constexpr float PI = 3.14159265358979323846f;
}

TEST(SpectrogramTest, SineWaveShape) {
    const float sample_rate = 44100.0f;
    const float frequency = 440.0f;
    const std::size_t n = 8192;
    std::vector<float> samples(n);
    for (std::size_t i = 0; i < n; ++i) {
        const float t = static_cast<float>(i) / sample_rate;
        samples[i] = std::sin(2.0f * PI * frequency * t) * 0.5f;
    }
    audioscope::dsp::SpectrogramProcessor sp;
    audioscope::dsp::SpectrogramConfig cfg;
    cfg.window_size = 1024;
    cfg.overlap = 512;
    const auto data = sp.compute(samples.data(), n, sample_rate, cfg);
    EXPECT_FALSE(data.empty());
    EXPECT_FALSE(data.frequencies.empty());
    EXPECT_FALSE(data.time_bins.empty());
    EXPECT_EQ(data.magnitudes.size(), data.time_bins.size());
    EXPECT_EQ(data.magnitudes.front().size(), data.frequencies.size());
}

TEST(SpectrogramTest, TooFewSamples) {
    audioscope::dsp::SpectrogramProcessor sp;
    std::vector<float> samples(100, 0.0f);
    const auto data = sp.compute(samples.data(), samples.size(), 44100.0f,
                                 audioscope::dsp::SpectrogramConfig{});
    EXPECT_TRUE(data.empty());
}

TEST(SpectrogramTest, ToImageData) {
    const float sample_rate = 44100.0f;
    std::vector<float> samples(4096);
    for (std::size_t i = 0; i < samples.size(); ++i)
        samples[i] = std::sin(static_cast<float>(i) * 0.1f);
    audioscope::dsp::SpectrogramProcessor sp;
    audioscope::dsp::SpectrogramConfig cfg;
    cfg.window_size = 1024; cfg.overlap = 512;
    const auto data = sp.compute(samples.data(), samples.size(), sample_rate, cfg);
    const auto img = data.to_image_data(64, 32);
    EXPECT_EQ(img.size(), 64u * 32u * 3u);
}
