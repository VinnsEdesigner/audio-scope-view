#pragma once

#include <cstddef>
#include <vector>

namespace audioscope {
namespace dsp {

/// Noise color for the noise generator.
enum class NoiseType {
    White,
    Pink,
    Brown,
};

/// Waveform generator kind. Parity with Rust `WaveformGenerator` (the subset
/// used by the simulation service). Additional Rust variants (chirp, AM, FM,
/// impulse, multi-tone) are supported via the `Kind` enum + `generate`.
enum class GeneratorKind {
    Sine,
    Square,
    Sawtooth,
    Triangle,
    Noise,
};

/// Generator configuration. The simple static constructors mirror the Rust
/// `WaveformGenerator::sine(...)` etc.
class WaveformGenerator {
public:
    WaveformGenerator(GeneratorKind kind, double frequency, float amplitude);

    static WaveformGenerator sine(double frequency, float amplitude);
    static WaveformGenerator square(double frequency, float amplitude);
    static WaveformGenerator sawtooth(double frequency, float amplitude);
    static WaveformGenerator triangle(double frequency, float amplitude);
    static WaveformGenerator white_noise(float amplitude);
    static WaveformGenerator pink_noise(float amplitude);
    static WaveformGenerator brown_noise(float amplitude);

    /// Generate `num_samples` samples at `sample_rate`.
    std::vector<float> generate(double sample_rate, std::size_t num_samples) const;

    GeneratorKind kind() const { return kind_; }
    double frequency() const { return frequency_; }
    float amplitude() const { return amplitude_; }
    NoiseType noise_type() const { return noise_type_; }

private:
    GeneratorKind kind_;
    double frequency_;
    float amplitude_;
    NoiseType noise_type_ = NoiseType::White;
};

} // namespace dsp
} // namespace audioscope
