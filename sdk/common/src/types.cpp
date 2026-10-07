#include "audioscope/common/types.hpp"

#include <cstdint>
#include <cstring>

namespace audioscope {
namespace common {

std::size_t sample_format_size(SampleFormat format) {
    switch (format) {
        case SampleFormat::F32: return 4;
        case SampleFormat::S16: return 2;
        case SampleFormat::S32: return 4;
    }
    return 4;
}

std::size_t convert_samples_to_f32(SampleFormat format, const void* src,
                                   float* dst, std::size_t count) {
    if (src == nullptr || dst == nullptr || count == 0) return 0;

    switch (format) {
        case SampleFormat::F32: {
            std::memcpy(dst, src, count * sizeof(float));
            return count;
        }
        case SampleFormat::S16: {
            const auto* s = static_cast<const std::int16_t*>(src);
            // Divide by 32768.0f (full-scale signed 16-bit) so ±1.0 maps to the
            // rails. The -32768 case maps to exactly -1.0f.
            constexpr float scale = 1.0f / 32768.0f;
            for (std::size_t i = 0; i < count; ++i) {
                dst[i] = static_cast<float>(s[i]) * scale;
            }
            return count;
        }
        case SampleFormat::S32: {
            const auto* s = static_cast<const std::int32_t*>(src);
            // Divide by 2147483648.0f (full-scale signed 32-bit).
            constexpr double scale = 1.0 / 2147483648.0;
            for (std::size_t i = 0; i < count; ++i) {
                dst[i] = static_cast<float>(static_cast<double>(s[i]) * scale);
            }
            return count;
        }
    }
    return 0;
}

} // namespace common
} // namespace audioscope
