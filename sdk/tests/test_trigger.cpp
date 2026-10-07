// Trigger tests — ported from the live TS path (scope-dsp.ts findTriggerIndex /
// triggeredWindow / resampleTo). The Rust trigger/detector.rs is dead code.

#include "audioscope/dsp/trigger.hpp"

#include <gtest/gtest.h>
#include <vector>

TEST(TriggerTest, RisingEdge) {
    // 0 -> 1 crossing at index 50.
    std::vector<float> data(100, 0.0f);
    for (std::size_t i = 50; i < data.size(); ++i) data[i] = 1.0f;
    audioscope::dsp::TriggerOptions opts;
    opts.edge = audioscope::dsp::TriggerEdge::Rising;
    opts.level = 0.5f;
    opts.hysteresis = 0.02f;
    const auto r = audioscope::dsp::find_trigger(data.data(), data.size(), opts);
    ASSERT_GE(r.index, 0);
    EXPECT_EQ(r.index, 50);
}

TEST(TriggerTest, FallingEdge) {
    std::vector<float> data(100, 1.0f);
    for (std::size_t i = 50; i < data.size(); ++i) data[i] = 0.0f;
    audioscope::dsp::TriggerOptions opts;
    opts.edge = audioscope::dsp::TriggerEdge::Falling;
    opts.level = 0.5f;
    const auto r = audioscope::dsp::find_trigger(data.data(), data.size(), opts);
    ASSERT_GE(r.index, 0);
    EXPECT_EQ(r.index, 50);
}

TEST(TriggerTest, NoCrossingReturnsMinusOne) {
    std::vector<float> data(100, 0.0f);
    audioscope::dsp::TriggerOptions opts;
    opts.edge = audioscope::dsp::TriggerEdge::Rising;
    opts.level = 0.5f;
    const auto r = audioscope::dsp::find_trigger(data.data(), data.size(), opts);
    EXPECT_EQ(r.index, -1);
    EXPECT_FALSE(r.armed);
}

TEST(TriggerTest, TriggeredWindowSize) {
    std::vector<float> data(200, 0.0f);
    for (std::size_t i = 100; i < data.size(); ++i) data[i] = 1.0f;
    audioscope::dsp::TriggerOptions opts;
    opts.edge = audioscope::dsp::TriggerEdge::Rising;
    opts.level = 0.5f;
    const auto w = audioscope::dsp::triggered_window(data.data(), data.size(), 64, opts);
    ASSERT_EQ(w.size(), 64u);
    // The window should start at or before index 100 and contain the rising edge.
    bool has_high = false;
    for (float v : w) if (v > 0.5f) has_high = true;
    EXPECT_TRUE(has_high);
}

TEST(TriggerTest, ResampleTo) {
    std::vector<float> data(100);
    for (std::size_t i = 0; i < data.size(); ++i) data[i] = static_cast<float>(i);
    const auto out = audioscope::dsp::resample_to(data.data(), data.size(), 50);
    EXPECT_EQ(out.size(), 50u);
    // Nearest-neighbor: out[0] should be data[0].
    EXPECT_NEAR(out[0], 0.0f, 1e-5f);
}

TEST(TriggerTest, ResampleEmpty) {
    const auto out = audioscope::dsp::resample_to(nullptr, 0, 50);
    EXPECT_TRUE(out.empty());
}
