// test_bindings.cpp — smoke tests for the Linux platform audio bindings.
//
// These tests exercise the AudioBinding *contract* without requiring a real
// audio device (the sandbox has no microphone). They verify:
//   1. The extern "C" factories return a non-null binding.
//   2. enumerate_devices() returns a non-empty list with a flagged default.
//   3. read_samples() is a safe no-op before start_capture() (returns 0).
//   4. is_capturing() is false on a freshly created binding.
//   5. start_capture() on a bogus device id returns false (no stream opened).
//   6. stop_capture() is idempotent on a never-started binding (no crash).
//
// A full capture round-trip is verified on hardware via an instrumented run,
// not in CI — the contract above is what CI can prove on a headless host.

#include "audioscope/common/audio_binding.hpp"
#include "audioscope/common/types.hpp"

#include <gtest/gtest.h>

#include <string>
#include <vector>

// The factories are extern "C" (defined in alsa_binding.cpp /
// pulse_binding.cpp) so the host language can name them without demangling.
// Declared at global scope here for the same reason.
extern "C" {
audioscope::bindings::AudioBinding* audioscope_linux_alsa_binding_create();
void audioscope_linux_alsa_binding_destroy(audioscope::bindings::AudioBinding*);
audioscope::bindings::AudioBinding* audioscope_linux_pulse_binding_create();
void audioscope_linux_pulse_binding_destroy(audioscope::bindings::AudioBinding*);
}

namespace {
using audioscope::bindings::AudioBinding;
using audioscope::common::AudioDevice;

void assert_contract(AudioBinding* b, const std::string& label) {
    ASSERT_NE(b, nullptr) << label << ": factory returned null";

    // Fresh binding is not capturing.
    EXPECT_FALSE(b->is_capturing()) << label << ": fresh binding should not capture";

    // read_samples before start is a safe no-op.
    float buf[8] = {};
    EXPECT_EQ(b->read_samples(buf, 8), std::size_t{0})
        << label << ": read before start must return 0";

    // enumerate_devices returns at least one device, with a default flagged.
    auto devs = b->enumerate_devices();
    ASSERT_FALSE(devs.empty()) << label << ": enumerate_devices empty";
    bool has_default = false;
    for (const auto& d : devs) {
        EXPECT_FALSE(d.id.empty()) << label << ": device id empty";
        has_default = has_default || d.is_default;
    }
    EXPECT_TRUE(has_default) << label << ": no device flagged is_default";

    // start_capture on a bogus device id must fail (no stream opened).
    EXPECT_FALSE(b->start_capture("__nonexistent_device__", 48000))
        << label << ": bogus device id must not open a stream";
    EXPECT_FALSE(b->is_capturing()) << label << ": failed start must not capture";

    // stop_capture is idempotent on a never-started binding.
    b->stop_capture();
    b->stop_capture();
    EXPECT_FALSE(b->is_capturing());
}

} // namespace

class LinuxBindingsTest : public ::testing::TestWithParam<const char*> {};

TEST_P(LinuxBindingsTest, FactoryAndContractHold) {
    const char* kind = GetParam();
    if (std::string(kind) == "alsa") {
        auto* b = audioscope_linux_alsa_binding_create();
        assert_contract(b, "alsa");
        audioscope_linux_alsa_binding_destroy(b);
    } else {
        auto* b = audioscope_linux_pulse_binding_create();
        assert_contract(b, "pulse");
        audioscope_linux_pulse_binding_destroy(b);
    }
}

INSTANTIATE_TEST_SUITE_P(PlatformBindings, LinuxBindingsTest,
    ::testing::Values("alsa", "pulse"));

// A standalone test for each factory so a single failure names the binding
// unambiguously in the ctest output (the parametrized output is terser).
TEST(AlsaBinding, FactoryReturnsInstance) {
    auto* b = audioscope_linux_alsa_binding_create();
    ASSERT_NE(b, nullptr);
    EXPECT_FALSE(b->is_capturing());
    auto devs = b->enumerate_devices();
    EXPECT_GE(devs.size(), 1u);
    audioscope_linux_alsa_binding_destroy(b);
}

TEST(PulseBinding, FactoryReturnsInstance) {
    auto* b = audioscope_linux_pulse_binding_create();
    ASSERT_NE(b, nullptr);
    EXPECT_FALSE(b->is_capturing());
    auto devs = b->enumerate_devices();
    EXPECT_GE(devs.size(), 1u);
    audioscope_linux_pulse_binding_destroy(b);
}
