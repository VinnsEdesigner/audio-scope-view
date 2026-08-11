// Compression — ported from rust/src/domain/compression/mod.rs (LZ4).
// Uses the LZ4 C API directly (lz4.h) so the same code compiles on every target;
// the Rust version used the `lz4` crate which wraps the same C library.

#include "audioscope/dsp/compression.hpp"

#include <lz4.h>

#include <cstring>

namespace audioscope {
namespace dsp {

float CompressedWaveform::compression_ratio() const {
    if (original_size == 0) return 0.0f;
    return (1.0f - static_cast<float>(compressed_size) / static_cast<float>(original_size)) * 100.0f;
}
bool CompressedWaveform::should_compress() const { return compression_ratio() > 10.0f; }

CompressedWaveform compress_waveform(const float* samples, std::size_t count) {
    CompressedWaveform result;
    result.sample_count = count;
    if (count == 0) return result;

    const std::size_t byte_count = count * sizeof(float);
    result.original_size = byte_count;

    // LZ4 worst-case bound for the compressed size.
    const int bound = LZ4_compressBound(static_cast<int>(byte_count));
    if (bound <= 0) return result;

    std::vector<std::uint8_t> compressed(static_cast<std::size_t>(bound));
    // The Rust path compressed the little-endian float bytes directly.
    const int written = LZ4_compress_default(
        reinterpret_cast<const char*>(samples),
        reinterpret_cast<char*>(compressed.data()),
        static_cast<int>(byte_count), bound);
    if (written <= 0) return result;

    compressed.resize(static_cast<std::size_t>(written));
    result.compressed_size = static_cast<std::size_t>(written);
    result.data = std::move(compressed);
    return result;
}

std::vector<float> decompress_waveform(const std::uint8_t* data, std::size_t size,
                                       std::size_t sample_count) {
    std::vector<float> out;
    if (size == 0 || sample_count == 0) return out;
    const std::size_t expected_bytes = sample_count * sizeof(float);
    out.resize(sample_count);
    const int read = LZ4_decompress_safe(
        reinterpret_cast<const char*>(data),
        reinterpret_cast<char*>(out.data()),
        static_cast<int>(size), static_cast<int>(expected_bytes));
    if (read < 0 || static_cast<std::size_t>(read) != expected_bytes) {
        return {}; // size mismatch or decode error
    }
    return out;
}

} // namespace dsp
} // namespace audioscope
