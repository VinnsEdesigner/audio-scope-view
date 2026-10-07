#pragma once

#include <cstddef>
#include <vector>

namespace audioscope {
namespace dsp {

/// @name Corrections — best-effort recovery of phone/audio-chain damage.
/// See ARCHITECTURE.md "Phone Audio Limitations" for what is reversible.
///@{

/// Subtract the mean (DC offset) in-place.
void correct_dc_offset(float* samples, std::size_t count);

/// Scale so the peak absolute value reaches `target` (default 1.0).
/// No-op when the signal is silent.
void normalize_peak(float* samples, std::size_t count, float target = 1.0f);

/// Apply an inverse frequency-response curve (e.g. to undo a known mic roll-off).
/// `inverse_curve` is linear magnitude per bin for a curve sampled at
/// `curve_size` points across [0, sample_rate/2]. Linear-interpolated.
void apply_inverse_frequency_response(float* samples, std::size_t count,
                                       const std::vector<float>& inverse_curve,
                                       float sample_rate);

/// Linearly interpolate across runs of samples below `threshold` (noise-gate
/// reconstruction). Edits in-place.
void interpolate_noise_gates(float* samples, std::size_t count, float threshold);

/// Best-effort dynamic-AGC estimate. Dynamic AGC is lossy and cannot be
/// fully reversed; this returns a smooth gain envelope estimate only.
struct EstimateAgcResult {
    std::vector<float> gain_envelope;  // per-sample estimated gain
    bool reversible = false;           // always false for dynamic AGC
};
EstimateAgcResult estimate_agc(const float* samples, std::size_t count);

///@}

} // namespace dsp
} // namespace audioscope
