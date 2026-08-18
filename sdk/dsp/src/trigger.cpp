// Trigger — ported from the live TypeScript path in
// apps/vyzorWeb/src/lib/scope-dsp.ts (findTriggerIndex / triggeredWindow /
// resampleTo). The Rust rust/src/domain/trigger/detector.rs is dead code and is
// NOT the source of truth (see ARCHITECTURE_IMPLEMENTATION_SPEC §6.4).

#include "audioscope/dsp/trigger.hpp"

#include <algorithm>

namespace audioscope {
namespace dsp {

namespace {
inline bool rising_hit(float prev, float cur, float level, float hyst) {
    return prev < level - hyst && cur >= level;
}
inline bool falling_hit(float prev, float cur, float level, float hyst) {
    return prev > level + hyst && cur <= level;
}
} // namespace

TriggerResult find_trigger(const float* data, std::size_t count,
                            const TriggerOptions& opts) {
    TriggerResult res;
    if (count == 0) return res;
    const float level = opts.level;
    const float hyst = opts.hysteresis;
    const std::size_t start = opts.holdoff > 0 ? opts.holdoff : 1;
    for (std::size_t i = start; i < count; ++i) {
        const float prev = data[i - 1];
        const float cur = data[i];
        bool hit = false;
        switch (opts.edge) {
            case TriggerEdge::Rising:  hit = rising_hit(prev, cur, level, hyst); break;
            case TriggerEdge::Falling: hit = falling_hit(prev, cur, level, hyst); break;
            case TriggerEdge::Auto:    hit = rising_hit(prev, cur, level, hyst)
                                           || falling_hit(prev, cur, level, hyst); break;
        }
        if (hit) {
            res.index = static_cast<int>(i);
            res.armed = true;
            return res;
        }
    }
    return res;
}

std::vector<float> triggered_window(const float* data, std::size_t count,
                                    std::size_t window_size,
                                    const TriggerOptions& opts) {
    if (count == 0) return {};
    const std::size_t size = std::min(window_size, count);
    TriggerOptions search = opts;
    if (search.holdoff == 0) search.holdoff = 1;
    const TriggerResult tr = find_trigger(data, count, search);
    if (tr.index < 0) return {};
    const std::size_t index = static_cast<std::size_t>(tr.index);
    const std::size_t search_limit = count > size ? count - size : 1;
    const std::size_t start = std::min(index, search_limit);
    std::vector<float> out(size);
    for (std::size_t off = 0; off < size; ++off) {
        const std::size_t idx = start + off;
        out[off] = idx < count ? data[idx] : 0.0f;
    }
    return out;
}

std::vector<float> resample_to(const float* data, std::size_t count, int points) {
    if (count == 0) return {};
    if (static_cast<int>(count) == points) {
        return std::vector<float>(data, data + count);
    }
    std::vector<float> out(points);
    const double step = static_cast<double>(count) / points;
    for (int i = 0; i < points; ++i) {
        const std::size_t idx = std::min(
            static_cast<std::size_t>(static_cast<double>(i) * step), count - 1);
        out[i] = data[idx];
    }
    return out;
}

} // namespace dsp
} // namespace audioscope
