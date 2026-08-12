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

// --- oscilloscope-side enums (shared by the bare-USB binding + DSP core) ---
// The legacy audio bindings never reference these; they exist so the
// AudioBinding interface can express scope + generator control uniformly.

enum class TriggerEdge : int { Rising = 0, Falling = 1, Both = 2 };
enum class Coupling : int { DC = 0, AC = 1, GND = 2 };
enum class Waveform : int { Sine = 0, Square = 1, Triangle = 2, Sawtooth = 3, DC = 4 };

/// Byte width of one sample in `format` (2 for S16, 4 for S32/F32).
std::size_t sample_format_size(SampleFormat format);

/// Convert `count` samples of `format` (interleaved, one channel) from `src`
/// into normalized float32 [-1, 1] in `dst`. `dst` must hold at least `count`
/// floats. S16 and S32 are divided by their full-scale int range; F32 is
/// copied verbatim. Returns the number of samples written (== `count`).
///
/// Every platform binding (ALSA/WASAPI/Oboe) calls this to normalize its native
/// PCM into the canonical DSP format, so the conversion lives once in `common`
/// rather than triplicated across bindings.
std::size_t convert_samples_to_f32(SampleFormat format, const void* src,
                                   float* dst, std::size_t count);

} // namespace common
} // namespace audioscope
