// Measurements tests — ported from rust/src/domain/measurements.rs #[test].
// Vectors: RMS of a unit sine (~0.707), DC offset of an arithmetic series,
// peak amplitude of a signed set, crest factor of a sine (~1.414),
// dB conversion round-trips.

#include "audioscope/dsp/measurements.hpp"

#include <gtest/gtest.h>
#include <cmath>
#include <limits>
#include <vector>

namespace {
constexpr float PI = 3.14159265358979323846f;
}

TEST(MeasurementsTest, RmsSineWave) {
    std::vector<float> samples(10000);
    for (std::size_t i = 0; i < samples.size(); ++i)
        samples[i] = std::sin(static_cast<float>(i) * 2.0f * PI / 100.0f);
    const float rms = audioscope::dsp::compute_rms(samples.data(), samples.size());
    EXPECT_NEAR(rms, 0.707f, 0.01f);
}

TEST(MeasurementsTest, DcOffset) {
    const std::vector<float> samples{1.0f, 2.0f, 3.0f, 4.0f, 5.0f};
    const float off = audioscope::dsp::compute_dc_offset(samples.data(), samples.size());
    EXPECT_NEAR(off, 3.0f, 0.001f);
}

TEST(MeasurementsTest, PeakAmplitude) {
    const std::vector<float> samples{-0.5f, 0.3f, 0.8f, -1.0f, 0.2f};
    const float peak = audioscope::dsp::find_peak_amplitude(samples.data(), samples.size());
    EXPECT_NEAR(peak, 1.0f, 0.001f);
}

TEST(MeasurementsTest, AnalyzeSineWave) {
    const float sample_rate = 44100.0f;
    const float frequency = 440.0f;
    std::vector<float> samples(4410);
    for (std::size_t i = 0; i < samples.size(); ++i) {
        const float t = static_cast<float>(i) / sample_rate;
        samples[i] = std::sin(2.0f * PI * frequency * t) * 0.8f;
    }
    const auto a = audioscope::dsp::analyze_waveform(samples.data(), samples.size(), sample_rate);
    EXPECT_NEAR(a.peak_amplitude, 0.8f, 0.01f);
    EXPECT_NEAR(a.crest_factor, 1.414f, 0.1f);
}

TEST(MeasurementsTest, AmplitudeToDb) {
    EXPECT_NEAR(audioscope::dsp::amplitude_to_db(1.0f), 0.0f, 0.001f);
    EXPECT_NEAR(audioscope::dsp::amplitude_to_db(0.5f), -6.0206f, 0.01f);
    const float r = audioscope::dsp::amplitude_to_db(0.0f);
    EXPECT_TRUE(std::isinf(r) && r < 0.0f);
}

TEST(MeasurementsTest, DbToAmplitude) {
    EXPECT_NEAR(audioscope::dsp::db_to_amplitude(0.0f), 1.0f, 0.001f);
    EXPECT_NEAR(audioscope::dsp::db_to_amplitude(-6.0206f), 0.5f, 0.01f);
    EXPECT_NEAR(audioscope::dsp::db_to_amplitude(-std::numeric_limits<float>::infinity()), 0.0f, 0.001f);
}

TEST(MeasurementsTest, PeakToDbfs) {
    EXPECT_NEAR(audioscope::dsp::peak_to_dbfs(1.0f), 0.0f, 0.001f);
    EXPECT_NEAR(std::fabs(audioscope::dsp::peak_to_dbfs(0.707f)), 3.0f, 0.1f);
}

TEST(MeasurementsTest, RmsToDbfs) {
    EXPECT_NEAR(audioscope::dsp::rms_to_dbfs(1.0f), 0.0f, 0.001f);
    EXPECT_NEAR(audioscope::dsp::rms_to_dbfs(0.5f), -6.0206f, 0.01f);
}

TEST(MeasurementsTest, DbRoundtrip) {
    const float original = 0.75f;
    const float db = audioscope::dsp::amplitude_to_db(original);
    const float recovered = audioscope::dsp::db_to_amplitude(db);
    EXPECT_NEAR(original, recovered, 0.0001f);

    const float original_dbfs = -12.0f;
    const float amp = audioscope::dsp::dbfs_to_amplitude(original_dbfs);
    const float recovered_dbfs = audioscope::dsp::rms_to_dbfs(amp);
    EXPECT_NEAR(original_dbfs, recovered_dbfs, 0.001f);
}
