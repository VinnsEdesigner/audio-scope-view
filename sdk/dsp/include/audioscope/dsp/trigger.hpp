#pragma once

#include <cstddef>
#include <vector>

namespace audioscope {
namespace dsp {

/// Trigger edge direction.
enum class TriggerEdge {
    Rising,
    Falling,
    Auto,  // accept either edge
};

/// Trigger mode (controls free-run / hold behavior at the UI layer).
enum class TriggerMode {
    Auto,
    Normal,
    Single,
};

/// Trigger search options. Parity with the live TS `findTriggerIndex` path
/// (the Rust `TriggerDetector` is dead code — the TS logic is the source of truth).
struct TriggerOptions {
    TriggerEdge edge = TriggerEdge::Auto;
    float level = 0.0f;
    float hysteresis = 0.02f;     // TS default
    std::size_t holdoff = 0;      // samples to skip at the start
};

struct TriggerResult {
    int index = -1;               // -1 = no trigger found
    bool armed = false;
};

/// Find the first qualifying trigger crossing.
/// Parity with TS `findTriggerIndex` (hysteresis + edge).
TriggerResult find_trigger(const float* data, std::size_t count,
                            const TriggerOptions& opts);

/// Align a frame on a trigger point and return a `window_size` window.
/// Returns an empty vector when no trigger fires (caller free-runs or holds).
std::vector<float> triggered_window(const float* data, std::size_t count,
                                    std::size_t window_size,
                                    const TriggerOptions& opts);

/// Resample `data` to exactly `points` samples by nearest-neighbor.
/// Parity with TS `resampleTo`.
std::vector<float> resample_to(const float* data, std::size_t count, int points);

} // namespace dsp
} // namespace audioscope
