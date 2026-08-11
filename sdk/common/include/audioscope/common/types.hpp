#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace audioscope {
namespace common {

/// Sample format produced by every audio binding.
enum class SampleFormat : int {
    F32,  // float32 normalized [-1, 1] — the canonical DSP format
    S16,  // signed 16-bit PCM (input devices often deliver this)
    S32,  // signed 32-bit PCM
};

/// Non-owning view over a contiguous sample buffer (one channel).
template <typename T>
class Span {
public:
    Span() = default;
    Span(const T* data, std::size_t count) : data_(data), count_(count) {}

    const T* data() const { return data_; }
    std::size_t size() const { return count_; }
    bool empty() const { return count_ == 0; }
    const T& operator[](std::size_t i) const { return data_[i]; }

private:
    const T* data_ = nullptr;
    std::size_t count_ = 0;
};

/// Owning sample buffer. Canonical storage is float32.
struct SampleBuffer {
    std::vector<float> samples;
    std::uint32_t sample_rate = 44100;
    std::uint32_t channels = 1;
    std::int64_t timestamp_ms = 0;

    bool empty() const { return samples.empty(); }
    std::size_t frame_count() const {
        return channels == 0 ? 0 : samples.size() / channels;
    }
};

/// A single enumerated audio input device.
struct AudioDevice {
    std::string id;          // platform-specific id (ALSA hw, WASAPI endpoint, Oboe id)
    std::string name;        // human-readable
    std::uint32_t channels = 1;
    std::uint32_t sample_rate = 44100;
    bool is_default = false;
};

} // namespace common
} // namespace audioscope
