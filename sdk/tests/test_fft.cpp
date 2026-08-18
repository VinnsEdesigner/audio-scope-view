// FFT tests — ported from rust/src/domain/fft_processor.rs #[test] blocks.
// Vectors: a 440 Hz sine wave, window-function sanity, normalized spectrum.

#include "audioscope/dsp/fft.hpp"
#include "audioscope/common/config.hpp"

#include <gtest/gtest.h>
#include <cmath>
#include <vector>

namespace {
constexpr float PI = 3.14159265358979323846f;
} // namespace

TEST(FftTest, SineWavePeakFrequency) {
    const float sample_rate = 44100.0f;
    const float frequency = 440.0f;
    const float duration = 0.01f;
    const std::size_t n = static_cast<std::size_t>(sample_rate * duration);
    std::vector<float> samples(n);
    for (std::size_t i = 0; i < n; ++i) {
        const float t = static_cast<float>(i) / sample_rate;
        samples[i] = std::sin(2.0f * PI * frequency * t) * 0.5f;
    }
    audioscope::dsp::FftProcessor fft;
    const auto spec = fft.compute_spectrum(samples.data(), n, sample_rate,
                                            audioscope::common::WindowType::Hann);
    EXPECT_LT(std::fabs(spec.peak_frequency - frequency), 50.0f)
        << "peak " << spec.peak_frequency << " should be near " << frequency;
}

TEST(FftTest, WindowFunctions) {
    std::vector<float> samples(1024, 1.0f);
    auto rect = audioscope::dsp::FftProcessor::apply_window(
        samples.data(), samples.size(), audioscope::common::WindowType::Rectangular);
    auto hann = audioscope::dsp::FftProcessor::apply_window(
        samples.data(), samples.size(), audioscope::common::WindowType::Hann);
    auto hamming = audioscope::dsp::FftProcessor::apply_window(
        samples.data(), samples.size(), audioscope::common::WindowType::Hamming);
    auto blackman = audioscope::dsp::FftProcessor::apply_window(
        samples.data(), samples.size(), audioscope::common::WindowType::Blackman);

    for (float v : rect) EXPECT_NEAR(v, 1.0f, 1e-6f);
    bool hann_attenuates = false, hamming_attenuates = false, blackman_attenuates = false;
    for (float v : hann) if (v < 1.0f) hann_attenuates = true;
    for (float v : hamming) if (v < 1.0f) hamming_attenuates = true;
    for (float v : blackman) if (v < 1.0f) blackman_attenuates = true;
    EXPECT_TRUE(hann_attenuates);
    EXPECT_TRUE(hamming_attenuates);
    EXPECT_TRUE(blackman_attenuates);
}

TEST(FftTest, SpectrumNormalized) {
    std::vector<float> samples(1024);
    for (std::size_t i = 0; i < samples.size(); ++i)
        samples[i] = std::sin(static_cast<float>(i) * 0.01f);
    audioscope::dsp::FftProcessor fft;
    auto spec = fft.compute_spectrum(samples.data(), samples.size(), 44100.0f,
                                     audioscope::common::WindowType::Hann);
    const auto norm = spec.normalized_magnitudes();
    ASSERT_FALSE(norm.empty());
    for (float v : norm) { EXPECT_GE(v, 0.0f); EXPECT_LE(v, 1.0f); }
}

TEST(FftTest, EmptyInput) {
    audioscope::dsp::FftProcessor fft;
    const auto spec = fft.compute_spectrum(nullptr, 0, 44100.0f,
                                            audioscope::common::WindowType::Hann);
    EXPECT_TRUE(spec.empty());
    const auto mags = fft.compute_magnitudes(nullptr, 0, 44100.0f);
    EXPECT_TRUE(mags.empty());
}
