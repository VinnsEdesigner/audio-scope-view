#pragma once

#include <cstdint>

namespace audioscope {
namespace common {

/// Window functions available across the DSP core.
enum class WindowType : int {
    Rectangular = 0,
    Hann = 1,
    Hamming = 2,
    Blackman = 3,
};

/// DSP pipeline configuration. Maps 1:1 to the existing settings GraphQL input
/// so UI settings reach the C++ core without a translation layer.
struct DspConfig {
    float sample_rate = 44100.0f;
    int block_size = 1024;
    int fft_size = 4096;
    WindowType window_type = WindowType::Hann;
    float overlap = 0.5f;          // 0..1 fraction
    float spectrogram_min_freq = 0.0f;
    float spectrogram_max_freq = 22050.0f;
};

} // namespace common
} // namespace audioscope
