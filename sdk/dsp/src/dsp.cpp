// AudioProcessor facade — owns the per-stream DSP pipeline state. Used by every
// platform binding and (via FFI) by the Rust server's schema_dsp resolvers.

#include "audioscope/dsp/dsp.hpp"

#include <algorithm>

namespace audioscope {
namespace dsp {

struct AudioProcessor::Impl {
    float sample_rate;
    int block_size;
    FftProcessor fft;
    WaveformAnalysis last_measurements{};
    Spectrum last_spectrum{};
    HarmonicAnalysis last_harmonics{};

    Impl(float sr, int bs) : sample_rate(sr), block_size(bs) {}
};

AudioProcessor::AudioProcessor(float sample_rate, int block_size)
    : impl_(std::make_unique<Impl>(sample_rate, block_size)) {}

AudioProcessor::~AudioProcessor() = default;
AudioProcessor::AudioProcessor(AudioProcessor&&) noexcept = default;
AudioProcessor& AudioProcessor::operator=(AudioProcessor&&) noexcept = default;

void AudioProcessor::process_frame(const float* in, std::size_t in_count,
                                   float* out, std::size_t out_count) {
    // Default pipeline: pass-through + measurements + spectrum.
    const std::size_t n = std::min(in_count, out_count);
    for (std::size_t i = 0; i < n; ++i) out[i] = in[i];
    for (std::size_t i = n; i < out_count; ++i) out[i] = 0.0f;

    impl_->last_measurements = analyze_waveform(in, in_count, impl_->sample_rate);
    impl_->last_spectrum = impl_->fft.compute_spectrum(in, in_count, impl_->sample_rate,
                                                       common::WindowType::Hann);
}

WaveformAnalysis AudioProcessor::measurements() const { return impl_->last_measurements; }
Spectrum AudioProcessor::spectrum() const { return impl_->last_spectrum; }
SpectrogramData AudioProcessor::spectrogram(const SpectrogramConfig& cfg) const {
    SpectrogramProcessor sp;
    return sp.compute(impl_->last_spectrum.window_size > 0 ? nullptr : nullptr,
                      0, impl_->sample_rate, cfg);
    // Note: spectrogram over the most recent block requires buffering the last
    // block's samples in Impl; added when the live capture path is wired (Step 1
    // delivers the algorithms; buffering is a Step 2/4 concern).
}
HarmonicAnalysis AudioProcessor::harmonics() const { return impl_->last_harmonics; }
TriggerResult AudioProcessor::trigger(const TriggerOptions& opts) const {
    // Trigger needs the most recent block's samples; buffered in Step 2.
    (void)opts;
    return TriggerResult{};
}

void AudioProcessor::set_sample_rate(float sample_rate) { impl_->sample_rate = sample_rate; }
float AudioProcessor::sample_rate() const { return impl_->sample_rate; }
int AudioProcessor::block_size() const { return impl_->block_size; }

} // namespace dsp
} // namespace audioscope
