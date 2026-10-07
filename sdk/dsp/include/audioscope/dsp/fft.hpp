#pragma once

#include "audioscope/common/config.hpp"

#include <cstddef>
#include <vector>

namespace audioscope {
namespace dsp {

/// Spectrum result. Mirrors the Rust `Spectrum` struct shape so the GraphQL
/// DTO (SpectrumResult) maps without translation.
struct Spectrum {
    std::vector<float> frequencies;    // Hz per bin
    std::vector<float> magnitudes_db;  // dBFS per bin, floored at -100
    std::vector<float> phases;         // radians per bin
    float peak_frequency = 0.0f;
    float peak_magnitude_db = -100.0f;
    float sample_rate = 44100.0f;
    int window_size = 0;                // logical size before zero-padding

    bool empty() const { return frequencies.empty(); }

    /// 10^(db/20) — linear magnitude per bin.
    std::vector<float> linear_magnitudes() const;

    /// Normalize magnitudes to 0..1 against [min_db=-100, max_db=peak].
    std::vector<float> normalized_magnitudes() const;
};

/// Radix-2 Cooley-Tukey FFT processor with windowing.
/// One implementation compiled to all targets (Linux/Windows/Android/WASM/FFI).
class FftProcessor {
public:
    /// @param max_fft_size largest FFT we will ever run; preallocated scratch.
    explicit FftProcessor(int max_fft_size = 16384);

    /// Apply a window function in-place-equivalent (returns a new vector).
    static std::vector<float> apply_window(const float* samples, std::size_t count,
                                           common::WindowType window);

    /// Magnitude spectrum in dB, zero-padded to next power of two, Hann-windowed.
    /// Kept for parity with the Rust `compute_magnitudes` path.
    std::vector<float> compute_magnitudes(const float* samples, std::size_t count,
                                          float sample_rate);

    /// Full spectrum (frequencies + magnitudes_db + phases + peak).
    Spectrum compute_spectrum(const float* samples, std::size_t count,
                              float sample_rate, common::WindowType window);

    /// Find the dominant peak frequency in [min_freq, max_freq].
    /// Returns nullopt-equivalent (freq<0) on empty input.
    float find_peak_frequency(const float* samples, std::size_t count,
                              float sample_rate, float min_freq, float max_freq);

    /// Smallest power of two >= v (the FFT's internal zero-pad size).
    static std::size_t next_pow_two(std::size_t v);

    void set_window(common::WindowType w) { default_window_ = w; }

private:
    void ensure_scratch(std::size_t size);

    int max_fft_size_;
    common::WindowType default_window_ = common::WindowType::Hann;
    std::vector<float> re_;
    std::vector<float> im_;
};

} // namespace dsp
} // namespace audioscope
