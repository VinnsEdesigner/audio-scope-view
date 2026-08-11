// Corrections tests — DC offset removal and peak normalization are the
// verifiable paths; inverse FR / noise-gate / AGC are best-effort and checked
// for shape only.

#include "audioscope/dsp/corrections.hpp"
#include "audioscope/dsp/measurements.hpp"

#include <gtest/gtest.h>
#include <cmath>
#include <vector>

TEST(CorrectionsTest, DcOffsetRemoval) {
    std::vector<float> samples{1.0f, 2.0f, 3.0f, 4.0f, 5.0f};
    audioscope::dsp::correct_dc_offset(samples.data(), samples.size());
    // After subtracting mean (3.0), the new mean is ~0.
    double mean = 0.0;
    for (float v : samples) mean += v;
    mean /= static_cast<double>(samples.size());
    EXPECT_NEAR(mean, 0.0, 1e-5);
}

TEST(CorrectionsTest, NormalizePeak) {
    std::vector<float> samples{-0.5f, 0.25f, 0.5f};
    audioscope::dsp::normalize_peak(samples.data(), samples.size(), 1.0f);
    const float peak = audioscope::dsp::find_peak_amplitude(samples.data(), samples.size());
    EXPECT_NEAR(peak, 1.0f, 1e-5f);
}

TEST(CorrectionsTest, NormalizeSilentIsNoOp) {
    std::vector<float> samples(8, 0.0f);
    audioscope::dsp::normalize_peak(samples.data(), samples.size(), 1.0f);
    for (float v : samples) EXPECT_EQ(v, 0.0f);
}

TEST(CorrectionsTest, InterpolateNoiseGates) {
    std::vector<float> samples{0.5f, 0.0f, 0.0f, 0.0f, -0.5f};
    audioscope::dsp::interpolate_noise_gates(samples.data(), samples.size(), 0.05f);
    // The three zeros should be interpolated, not left at zero.
    EXPECT_NE(samples[1], 0.0f);
    EXPECT_NE(samples[2], 0.0f);
    EXPECT_NE(samples[3], 0.0f);
}

TEST(CorrectionsTest, EstimateAgcShape) {
    std::vector<float> samples(1024);
    for (std::size_t i = 0; i < samples.size(); ++i)
        samples[i] = std::sin(static_cast<float>(i) * 0.05f);
    const auto r = audioscope::dsp::estimate_agc(samples.data(), samples.size());
    EXPECT_EQ(r.gain_envelope.size(), samples.size());
    EXPECT_FALSE(r.reversible); // dynamic AGC is lossy
}
