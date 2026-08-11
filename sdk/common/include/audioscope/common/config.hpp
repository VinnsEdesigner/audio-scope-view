#pragma once

#include <cstdint>
#include <string>

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

    /// Returns a normalized copy: clamps `overlap` to [0, 1), bounds the
    /// spectrogram band to [0, sample_rate/2] with min <= max, rounds `fft_size`
    /// up to the next power of two, and coerces `block_size` to >= 1.
    /// Call this before handing a config to the DSP core so every binding and
    /// the FFI share one validation path instead of re-clamping ad hoc.
    DspConfig normalized() const;
};

/// Parse a DspConfig from a JSON object string, e.g.
///   {"sample_rate":48000,"block_size":2048,"fft_size":8192,
///    "window_type":"hann","overlap":0.75,
///    "spectrogram_min_freq":20,"spectrogram_max_freq":20000}
///
/// `window_type` accepts the names returned by `window_type_name()` (case
/// insensitive). Missing fields keep their DspConfig defaults. Returns false
/// (and leaves `out` untouched) only on a structural parse error; unknown keys
/// are ignored so the UI can add fields without breaking older cores.
///
/// No external JSON dependency — a tiny hand-rolled parser keeps `common`
/// free of I/O and third-party headers (per ARCHITECTURE.md Layer 1 rules).
bool from_json(const std::string& json, DspConfig& out);

/// Serialize a DspConfig to the JSON shape accepted by `from_json`.
std::string to_json(const DspConfig& config);

/// Case-insensitive name → WindowType. Returns false for unknown names.
bool parse_window_type(const std::string& name, WindowType& out);

/// WindowType → canonical name ("rectangular"/"hann"/"hamming"/"blackman").
std::string window_type_name(WindowType type);

} // namespace common
} // namespace audioscope
