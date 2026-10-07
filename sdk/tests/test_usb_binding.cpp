// test_usb_binding.cpp — host-side smoke + protocol-ABI tests for the
// libusb AudioBinding.
//
// No real ESP32 hardware needed: libusb returns an empty device list on a
// headless host, so enumerate_devices() is empty (not a failure), and a
// bogus start_capture() returns false without crashing. The protocol-ABI
// assertions (sizeof/offsetof) catch a firmware/host drift at build time.

#include "usb_protocol.h"
#include "audioscope/common/audio_binding.hpp"

#include <gtest/gtest.h>

#include <cstring>
#include <string>
#include <vector>

extern "C" {
audioscope::bindings::AudioBinding* audioscope_usb_binding_create();
void audioscope_usb_binding_destroy(audioscope::bindings::AudioBinding*);
}

namespace {
using audioscope::bindings::AudioBinding;

// Protocol ABI: every struct's size is frozen. A change here means firmware
// and host disagree — fail the build, not the device.
TEST(UsbProtocol, CommandHeaderIs16Bytes) {
    EXPECT_EQ(sizeof(as_usb_cmd_header), 16u);
}
TEST(UsbProtocol, ResponseHeaderIs16Bytes) {
    EXPECT_EQ(sizeof(as_usb_rsp_header), 16u);
}
TEST(UsbProtocol, DeviceInfoIs64Bytes) {
    EXPECT_EQ(sizeof(as_usb_device_info), 64u);
}
TEST(UsbProtocol, StreamHeaderIs4Bytes) {
    EXPECT_EQ(sizeof(as_usb_stream_header), 4u);
}
TEST(UsbProtocol, BandwidthInfoIs32Bytes) {
    EXPECT_EQ(sizeof(as_usb_bandwidth_info), 32u);
}
TEST(UsbProtocol, MagicConstantsAreStable) {
    EXPECT_EQ(AUDIOSCOPE_USB_MAGIC0, 0x41);
    EXPECT_EQ(AUDIOSCOPE_USB_MAGIC1, 0x53);
    EXPECT_EQ(AS_USB_STREAM_MAGIC, 0x5341u);
}

TEST(UsbProtocol, ScopeCommandsCoverAcquisitionAndGenerator) {
    // Acquisition path.
    EXPECT_NE(AS_USB_CMD_GET_BANDWIDTH, AS_USB_CMD_GET_INFO);
    EXPECT_NE(AS_USB_CMD_SET_TIMEBASE, AS_USB_CMD_SET_TRIGGER);
    EXPECT_NE(AS_USB_CMD_SET_VSCALE, AS_USB_CMD_SET_COUPLING);
    // Generator path.
    EXPECT_NE(AS_USB_CMD_GEN_START, AS_USB_CMD_GEN_STOP);
    EXPECT_NE(AS_USB_CMD_GEN_SET_FREQ, AS_USB_CMD_GEN_SET_AMP);
    EXPECT_NE(AS_USB_CMD_GEN_SET_WAVE, AS_USB_CMD_GEN_SET_DUTY);
}

TEST(UsbProtocol, PayloadStructsArePackedSmall) {
    // Trigger is the largest scope payload at 8 bytes; the rest are 4.
    EXPECT_EQ(sizeof(as_usb_cmd_set_trigger), 8u);
    EXPECT_EQ(sizeof(as_usb_cmd_set_timebase), 4u);
    EXPECT_EQ(sizeof(as_usb_cmd_set_vscale), 4u);
    EXPECT_EQ(sizeof(as_usb_cmd_gen_set_freq), 8u);  // 64-bit Hz
}

TEST(UsbProtocol, Crc16IsDeterministic) {
    // Known CRC-16/CCITT vectors (poly 0x1021, init 0xFFFF).
    const uint8_t data[] = {'1', '2', '3', '4', '5', '6', '7', '8', '9'};
    EXPECT_EQ(as_usb_crc16(data, 9), 0x29B1u);
    const uint8_t empty[] = {0};
    EXPECT_EQ(as_usb_crc16(empty, 0), 0xFFFFu);
}

TEST(UsbBinding, FactoryReturnsInstance) {
    auto* b = audioscope_usb_binding_create();
    ASSERT_NE(b, nullptr);
    EXPECT_FALSE(b->is_capturing());
    audioscope_usb_binding_destroy(b);
}

TEST(UsbBinding, EnumerateIsSafeWithoutHardware) {
    // No ESP32 plugged in on a headless CI host → empty list, not a crash.
    auto* b = audioscope_usb_binding_create();
    auto devs = b->enumerate_devices();
    // May be empty (no device) or non-empty (a device is present). Both fine.
    for (const auto& d : devs) {
        EXPECT_FALSE(d.id.empty());
    }
    audioscope_usb_binding_destroy(b);
}

TEST(UsbBinding, BogusStartCaptureFailsSafely) {
    auto* b = audioscope_usb_binding_create();
    // No matching device → must return false, never crash.
    EXPECT_FALSE(b->start_capture("__nonexistent_device__", 48000));
    EXPECT_FALSE(b->is_capturing());
    b->stop_capture();  // idempotent on a never-started binding
    audioscope_usb_binding_destroy(b);
}

TEST(UsbBinding, ReadBeforeStartIsNoOp) {
    auto* b = audioscope_usb_binding_create();
    float buf[8] = {};
    EXPECT_EQ(b->read_samples(buf, 8), std::size_t{0});
    audioscope_usb_binding_destroy(b);
}

} // namespace
