// usb_binding.h — host-side AudioBinding over libusb (the "bare" ESP32 path).
//
// Declares the extern "C" factory so the host (and the test) can name it
// without demangling. Implementation in usb_binding.cpp. Mirrors the factory
// shape of oboe_capture.cpp / alsa_binding.cpp / wasapi_binding.cpp — every
// platform binding exposes the same create/destroy pair.

#pragma once

#include "audioscope/common/audio_binding.hpp"

namespace audioscope {
namespace bindings {

/// Create the libusb AudioBinding (talks the custom USB protocol directly,
/// NOT through the OS audio stack). Returns nullptr on OOM.
AudioBinding* create_usb_binding();

} // namespace bindings
} // namespace audioscope

extern "C" {
/// C factory — matches the other platform bindings.
audioscope::bindings::AudioBinding* audioscope_usb_binding_create();
void audioscope_usb_binding_destroy(audioscope::bindings::AudioBinding* b);
}
