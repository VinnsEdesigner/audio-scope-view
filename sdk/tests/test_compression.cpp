// Compression tests — ported from rust/src/domain/compression/mod.rs #[test].
// Verifies the LZ4 round-trip is lossless for float32 samples.

#include "audioscope/dsp/compression.hpp"

#include <gtest/gtest.h>
#include <cmath>
#include <vector>

TEST(CompressionTest, CompressDecompressRoundtrip) {
    std::vector<float> samples(1000);
    for (std::size_t i = 0; i < samples.size(); ++i)
        samples[i] = std::sin(static_cast<float>(i) * 0.01f) * 0.5f;
    const auto result = audioscope::dsp::compress_waveform(samples.data(), samples.size());
    ASSERT_FALSE(result.data.empty());
    const auto decompressed = audioscope::dsp::decompress_waveform(
        result.data.data(), result.data.size(), result.sample_count);
    ASSERT_EQ(decompressed.size(), samples.size());
    for (std::size_t i = 0; i < samples.size(); ++i)
        EXPECT_NEAR(samples[i], decompressed[i], 1e-6f)
            << "mismatch at " << i;
}

TEST(CompressionTest, EmptyInput) {
    const auto result = audioscope::dsp::compress_waveform(nullptr, 0);
    EXPECT_TRUE(result.data.empty());
    EXPECT_EQ(result.original_size, 0u);
    const auto out = audioscope::dsp::decompress_waveform(nullptr, 0, 0);
    EXPECT_TRUE(out.empty());
}

TEST(CompressionTest, CompressionMachineryWorks) {
    std::vector<float> samples(4096);
    for (std::size_t i = 0; i < samples.size(); ++i)
        samples[i] = std::sin(static_cast<float>(i) * 0.01f);
    const auto compressed = audioscope::dsp::compress_waveform(samples.data(), samples.size());
    EXPECT_GT(compressed.original_size, 0u);
    EXPECT_GT(compressed.compressed_size, 0u);
    // LZ4 on small raw-float buffers can expand (float byte patterns don't
    // repeat enough); the ratio may be negative — that is expected and not a
    // bug. What matters is the round-trip is lossless.
    const auto recovered = audioscope::dsp::decompress_waveform(
        compressed.data.data(), compressed.data.size(), compressed.sample_count);
    ASSERT_EQ(recovered.size(), samples.size());
    for (std::size_t i = 0; i < samples.size(); ++i)
        EXPECT_NEAR(samples[i], recovered[i], 1e-6f);
}
