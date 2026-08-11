#pragma once

#include "audioscope/common/types.hpp"

#include <cstddef>
#include <string>
#include <vector>

namespace audioscope {
namespace bindings {

/// Abstract audio capture interface. Each platform (ALSA/WASAPI/Oboe/WebAudio)
/// implements this; the DSP core is agnostic to the platform underneath.
class AudioBinding {
public:
    virtual ~AudioBinding() = default;

    /// List available input devices.
    virtual std::vector<common::AudioDevice> enumerate_devices() = 0;

    /// Open `device_id` for capture at `sample_rate`. Returns false on failure.
    virtual bool start_capture(const std::string& device_id,
                               int sample_rate) = 0;

    /// Stop an active capture.
    virtual void stop_capture() = 0;

    /// Read up to `count` samples into `buffer` (float32, mono or de-interleaved).
    /// Returns the number of samples actually read.
    virtual std::size_t read_samples(float* buffer, std::size_t count) = 0;

    /// True when a capture stream is open and running.
    virtual bool is_capturing() const = 0;
};

} // namespace bindings
} // namespace audioscope
