#pragma once

#include <cstddef>
#include <cstdint>
#include <vector>

namespace audioscope {
namespace dsp {

/// Compressed waveform payload. Mirrors Rust `CompressedWaveform`.
struct CompressedWaveform {
    std::vector<std::uint8_t> data;
    std::size_t sample_count = 0;
    std::size_t original_size = 0;   // bytes
    std::size_t compressed_size = 0; // bytes

    /// Compression ratio as a percentage (0 = no reduction).
    float compression_ratio() const;
    /// True when the reduction is worthwhile (>10%).
    bool should_compress() const;
};

/// LZ4-compress a float32 sample buffer (little-endian).
/// Returns an empty result for empty input.
CompressedWaveform compress_waveform(const float* samples, std::size_t count);

/// LZ4-decompress back to float32. `sample_count` is the expected frame count.
/// Returns an empty vector on size mismatch or decode error.
std::vector<float> decompress_waveform(const std::uint8_t* data, std::size_t size,
                                        std::size_t sample_count);

} // namespace dsp
} // namespace audioscope
