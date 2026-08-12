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

    // --- scope + signal-generator extensions ---------------------------
    // Default implementations return "unsupported" so the legacy audio
    // bindings (ALSA/WASAPI/Oboe/PulseAudio) stay source-compatible; only
    // the bare-USB ESP32 binding overrides them. This is what turns the
    // AudioBinding into a real oscilloscope + generator interface.

    /// Real analog/digital limits of the input path. Empty std::vector ⇒ the
    /// binding has no scope front-end (it's a plain audio device).
    struct ScopeCapability {
        std::uint32_t adc_max_rate_hz = 0;   // hard ADC clock max
        std::uint32_t analog_bw_hz = 0;      // -3 dB analog input BW
        std::uint32_t effective_bw_hz = 0;   // min(adc_max_rate/2, analog_bw)
        std::uint32_t resolution_bits = 0;   // ADC resolution
        std::uint32_t vrange_mv = 0;         // full-scale input range, mV p-p
        std::uint32_t gen_max_freq_hz = 0;   // generator max frequency
        std::uint32_t gen_resolution_bits = 0;
    };
    virtual ScopeCapability scope_capability() const { return {}; }
    virtual bool supports_generator() const { return false; }

    /// Trigger + vertical + timebase configuration (no-op if unsupported).
    virtual bool set_trigger(common::TriggerEdge /*edge*/, float /*level_v*/,
                             std::uint32_t /*holdoff_us*/) { return false; }
    virtual bool set_vertical(float /*volts_per_div*/, common::Coupling /*c*/) {
        return false;
    }
    virtual bool set_timebase(std::uint32_t /*ns_per_div*/) { return false; }

    /// Signal generator (PWM / DDS output). No-op if unsupported.
    virtual bool generator_start(common::Waveform /*w*/, std::uint64_t /*freq_hz*/,
                                 std::uint32_t /*amp_mv*/, int32_t /*offset_mv*/,
                                 std::uint32_t /*duty_permille*/) { return false; }
    virtual bool generator_stop() { return false; }
};

} // namespace bindings
} // namespace audioscope
