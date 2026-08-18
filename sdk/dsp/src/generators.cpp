// Waveform generators — ported from rust/src/domain/waveform_generators.rs.
// The simple generators (sine/square/sawtooth/triangle/noise) used by the
// simulation service are the scope of the C++ core. Additional Rust variants
// (chirp/AM/FM/impulse/multi-tone) can be added later; they are not on the
// GraphQL DSP surface today.
//
// Noise uses a deterministic xoshiro-style PRNG seeded per-call so tests are
// reproducible and the core has no dependency on a system RNG.

#include "audioscope/dsp/generators.hpp"

#include <cmath>
#include <cstdint>

namespace audioscope {
namespace dsp {

namespace {
constexpr double PI_D = 3.14159265358979323846;

// SplitMix64 → xoshiro256** for deterministic, good-quality pseudo-random
// doubles in [-1, 1). Seeded from amplitude so the same call is reproducible.
class Rng {
public:
    explicit Rng(std::uint64_t seed) : s0_(seed), s1_(seed ^ 0x9E3779B97F4A7C15ULL) {
        if (s0_ == 0) s0_ = 0xDEADBEEFCAFEBABEULL;
        if (s1_ == 0) s1_ = 0x9E3779B97F4A7C15ULL;
        for (int i = 0; i < 4; ++i) next();
    }
    double next_unit() {
        // Map a 64-bit value to [-1, 1).
        const std::uint64_t v = next();
        return (static_cast<double>(v >> 1) / static_cast<double>(INT64_MAX)) - 1.0;
    }
private:
    static inline std::uint64_t splitmix64(std::uint64_t& x) {
        std::uint64_t z = (x += 0x9E3779B97F4A7C15ULL);
        z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
        z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
        return z ^ (z >> 31);
    }
    std::uint64_t next() {
        const std::uint64_t result = s0_ * 5;
        const std::uint64_t t = s1_ << 17;
        s1_ ^= s0_; s0_ ^= s1_; s1_ ^= t;
        s0_ = s0_ * 5 + 0x9E3779B97F4A7C15ULL;
        (void)splitmix64;
        return result;
    }
    std::uint64_t s0_, s1_;
};
} // namespace

WaveformGenerator::WaveformGenerator(GeneratorKind kind, double frequency, float amplitude)
    : kind_(kind), frequency_(frequency), amplitude_(amplitude) {}

WaveformGenerator WaveformGenerator::sine(double f, float a) { return {GeneratorKind::Sine, f, a}; }
WaveformGenerator WaveformGenerator::square(double f, float a) { return {GeneratorKind::Square, f, a}; }
WaveformGenerator WaveformGenerator::sawtooth(double f, float a) { return {GeneratorKind::Sawtooth, f, a}; }
WaveformGenerator WaveformGenerator::triangle(double f, float a) { return {GeneratorKind::Triangle, f, a}; }
WaveformGenerator WaveformGenerator::white_noise(float a) { return {GeneratorKind::Noise, a, a}; }
WaveformGenerator WaveformGenerator::pink_noise(float a) {
    WaveformGenerator g(GeneratorKind::Noise, 0.0, a);
    g.noise_type_ = NoiseType::Pink;
    return g;
}
WaveformGenerator WaveformGenerator::brown_noise(float a) {
    WaveformGenerator g(GeneratorKind::Noise, 0.0, a);
    g.noise_type_ = NoiseType::Brown;
    return g;
}

std::vector<float> WaveformGenerator::generate(double sample_rate, std::size_t n) const {
    std::vector<float> out(n);
    const float amp = amplitude_;
    switch (kind_) {
        case GeneratorKind::Sine: {
            const double f = frequency_;
            for (std::size_t i = 0; i < n; ++i) {
                const double t = static_cast<double>(i) / sample_rate;
                out[i] = static_cast<float>(std::sin(2.0 * PI_D * f * t) * amp);
            }
            break;
        }
        case GeneratorKind::Square: {
            const double period = sample_rate / frequency_;
            const std::size_t duty = static_cast<std::size_t>(period * 0.5);
            for (std::size_t i = 0; i < n; ++i) {
                const std::size_t pos = i % static_cast<std::size_t>(period);
                out[i] = pos < duty ? amp : -amp;
            }
            break;
        }
        case GeneratorKind::Sawtooth: {
            const double period = sample_rate / frequency_;
            for (std::size_t i = 0; i < n; ++i) {
                const double t = std::fmod(static_cast<double>(i) / period, 1.0);
                out[i] = static_cast<float>((2.0 * t - 1.0) * amp);
            }
            break;
        }
        case GeneratorKind::Triangle: {
            const double period = sample_rate / frequency_;
            for (std::size_t i = 0; i < n; ++i) {
                double t = std::fmod(static_cast<double>(i) / period, 1.0);
                if (t < 0.0) t += 1.0;
                out[i] = static_cast<float>((t < 0.5 ? (4.0 * t - 1.0) : (-4.0 * t + 3.0)) * amp);
            }
            break;
        }
        case GeneratorKind::Noise: {
            Rng rng(static_cast<std::uint64_t>(n) ^ 0xA5A5A5A5A5A5A5A5ULL);
            if (noise_type_ == NoiseType::White) {
                for (std::size_t i = 0; i < n; ++i) {
                    out[i] = static_cast<float>(rng.next_unit() * amp);
                }
            } else if (noise_type_ == NoiseType::Pink) {
                // Voss-McCartney approximation (same coefficient set as Rust).
                double b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
                for (std::size_t i = 0; i < n; ++i) {
                    const double w = rng.next_unit();
                    b0 = 0.99886 * b0 + w * 0.0555179;
                    b1 = 0.99332 * b1 + w * 0.0750759;
                    b2 = 0.96900 * b2 + w * 0.1538520;
                    b3 = 0.86650 * b3 + w * 0.3104856;
                    b4 = 0.55000 * b4 + w * 0.5329522;
                    b5 = -0.7616 * b5 - w * 0.0168980;
                    double v = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * amp / 7.0;
                    b6 = w * 0.115926;
                    if (v > amp) v = amp; else if (v < -amp) v = -amp;
                    out[i] = static_cast<float>(v);
                }
            } else { // Brown
                double last = 0.0;
                for (std::size_t i = 0; i < n; ++i) {
                    const double w = rng.next_unit();
                    last = (last + 0.02 * w) / 1.02;
                    double v = (last * 3.5) * amp / 7.0;
                    if (v > amp) v = amp; else if (v < -amp) v = -amp;
                    out[i] = static_cast<float>(v);
                }
            }
            break;
        }
    }
    return out;
}

} // namespace dsp
} // namespace audioscope
