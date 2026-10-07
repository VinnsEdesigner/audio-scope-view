// Generator tests — verify the simple generators produce the right shape and
// amplitude (parity with the Rust WaveformGenerator behavior).

#include "audioscope/dsp/generators.hpp"

#include <gtest/gtest.h>
#include <cmath>
#include <vector>

namespace {
constexpr double PI_D = 3.14159265358979323846;
}

TEST(GeneratorsTest, SineAmplitude) {
    auto gen = audioscope::dsp::WaveformGenerator::sine(440.0, 0.5f);
    const auto samples = gen.generate(44100.0, 4410);
    ASSERT_EQ(samples.size(), 4410u);
    float peak = 0.0f;
    for (float v : samples) if (std::fabs(v) > peak) peak = std::fabs(v);
    EXPECT_NEAR(peak, 0.5f, 0.02f);
}

TEST(GeneratorsTest, SquareAlternates) {
    auto gen = audioscope::dsp::WaveformGenerator::square(100.0, 1.0f);
    const auto samples = gen.generate(44100.0, 441);
    ASSERT_FALSE(samples.empty());
    bool has_pos = false, has_neg = false;
    for (float v : samples) {
        if (v > 0.5f) has_pos = true;
        if (v < -0.5f) has_neg = true;
    }
    EXPECT_TRUE(has_pos);
    EXPECT_TRUE(has_neg);
}

TEST(GeneratorsTest, SawtoothRange) {
    auto gen = audioscope::dsp::WaveformGenerator::sawtooth(100.0, 1.0f);
    const auto samples = gen.generate(44100.0, 441);
    float min_v = 1e30f, max_v = -1e30f;
    for (float v : samples) {
        if (v < min_v) min_v = v;
        if (v > max_v) max_v = v;
    }
    EXPECT_LE(min_v, 0.0f);
    EXPECT_GE(max_v, 0.0f);
    EXPECT_NEAR(std::fabs(min_v) + max_v, 2.0f, 0.2f);
}

TEST(GeneratorsTest, TriangleRange) {
    auto gen = audioscope::dsp::WaveformGenerator::triangle(100.0, 1.0f);
    const auto samples = gen.generate(44100.0, 441);
    float peak = 0.0f;
    for (float v : samples) if (std::fabs(v) > peak) peak = std::fabs(v);
    EXPECT_NEAR(peak, 1.0f, 0.05f);
}

TEST(GeneratorsTest, WhiteNoiseBounded) {
    auto gen = audioscope::dsp::WaveformGenerator::white_noise(0.8f);
    const auto samples = gen.generate(44100.0, 1000);
    for (float v : samples) {
        EXPECT_LE(v, 0.8f);
        EXPECT_GE(v, -0.8f);
    }
}

TEST(GeneratorsTest, BrownNoiseBounded) {
    auto gen = audioscope::dsp::WaveformGenerator::brown_noise(0.8f);
    const auto samples = gen.generate(44100.0, 1000);
    for (float v : samples) {
        EXPECT_LE(v, 0.8f);
        EXPECT_GE(v, -0.8f);
    }
}
