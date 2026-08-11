#pragma once

#include "audioscope/common/config.hpp"
#include "audioscope/dsp/fft.hpp"
#include "audioscope/dsp/measurements.hpp"
#include "audioscope/dsp/spectrogram.hpp"
#include "audioscope/dsp/trigger.hpp"

#include <memory>

namespace audioscope {
namespace dsp {

/// Facade that owns the DSP pipeline state for a single capture stream.
/// One AudioProcessor per active session. Used by every platform binding and
/// (via FFI) by the Rust server's schema_dsp resolvers.
class AudioProcessor {
public:
    AudioProcessor(float sample_rate, int block_size);
    ~AudioProcessor();

    AudioProcessor(const AudioProcessor&) = delete;
    AudioProcessor& operator=(const AudioProcessor&) = delete;
    AudioProcessor(AudioProcessor&&) noexcept;
    AudioProcessor& operator=(AudioProcessor&&) noexcept;

    /// Run the configured pipeline on one block. `out` receives processed samples.
    void process_frame(const float* in, std::size_t in_count,
                       float* out, std::size_t out_count);

    /// Last computed measurements (recomputed on each process_frame).
    WaveformAnalysis measurements() const;
    /// Last computed spectrum.
    Spectrum spectrum() const;
    /// Compute a spectrogram for the given config over the most recent block.
    SpectrogramData spectrogram(const SpectrogramConfig& cfg) const;
    /// Last computed harmonic analysis.
    HarmonicAnalysis harmonics() const;
    /// Last computed trigger result for the most recent block.
    TriggerResult trigger(const TriggerOptions& opts) const;

    void set_sample_rate(float sample_rate);
    float sample_rate() const;
    int block_size() const;

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace dsp
} // namespace audioscope
