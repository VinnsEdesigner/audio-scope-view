#pragma once

#include <cstdint>
#include <vector>

namespace audioscope {
namespace dsp {

/// Time-domain measurements of a frame. Mirrors Rust `WaveformAnalysis`.
/// (Note: Rust field `rms_amplitude`; here we keep `rms` for brevity and expose
///  an alias in the facade.)
struct WaveformAnalysis {
    float peak_amplitude = 0.0f;
    float negative_peak_amplitude = 0.0f;
    float rms = 0.0f;
    float dc_offset = 0.0f;
    float crest_factor = 0.0f;
    float zero_crossing_rate = 0.0f;
    float dominant_frequency = 0.0f;
    float thd_percent = 0.0f;
    float snr_db = 0.0f;
};

/// One harmonic component in a harmonic analysis.
struct FrequencyComponent {
    float frequency = 0.0f;
    float magnitude = 0.0f;     // dB
    std::uint32_t harmonic = 1; // 1 = fundamental, 2 = 2nd harmonic, ...
    float phase = 0.0f;         // radians
};

/// Harmonic / THD analysis. Mirrors Rust `HarmonicAnalysis`.
struct HarmonicAnalysis {
    FrequencyComponent fundamental;
    std::vector<FrequencyComponent> harmonics;
    float thd = 0.0f;          // 0..1
    float thdn = 0.0f;         // 0..1 (noise-inclusive)
    float signal_energy = 0.0f;
    float noise_energy = 0.0f;
};

/// @name Scalar measurement functions (pure, no state)
///@{
float find_peak_amplitude(const float* samples, std::size_t count);
float find_negative_peak_amplitude(const float* samples, std::size_t count);
float compute_rms(const float* samples, std::size_t count);
float compute_dc_offset(const float* samples, std::size_t count);
float zero_crossing_rate(const float* samples, std::size_t count);
float estimate_dominant_frequency(const float* samples, std::size_t count,
                                  float sample_rate);
/// THD (percent) and SNR (dB). The fast-path estimate, parity with Rust
/// `estimate_thd_snr`.
void   estimate_thd_snr(const float* samples, std::size_t count, float rms,
                       float& out_thd_percent, float& out_snr_db);
///@}

/// Full time-domain analysis of a frame.
WaveformAnalysis analyze_waveform(const float* samples, std::size_t count,
                                  float sample_rate);

/// Harmonic analysis via FFT. Uses the FftProcessor internally.
HarmonicAnalysis analyze_harmonics(const float* samples, std::size_t count,
                                   float sample_rate);

/// @name dB conversions (parity with Rust measurements.rs)
///@{
float amplitude_to_db(float amplitude);
float db_to_amplitude(float db);
float peak_to_dbfs(float peak_amplitude);
float rms_to_dbfs(float rms_amplitude);
float dbfs_to_amplitude(float dbfs);
float crest_factor_db(float crest_factor);
float snr_to_db(float signal_amplitude, float noise_amplitude);
///@}

} // namespace dsp
} // namespace audioscope
