// device_enumeration.h — C++ audio input device enumeration for Android.
//
// Declares the function jni_bridge.cpp calls to enumerate the OS's connected
// audio input devices (builtin mic, wired headset, USB mics, Bluetooth) by
// name. Implementation in device_enumeration.cpp. No Kotlin/Java enumeration
// logic — the C++ side drives the JVM via JNI directly (AudioManager +
// AudioDeviceInfo) and merges a pure-C++ parse of /proc/asound for USB ALSA
// card names + vendor/product ids.

#pragma once

#include <jni.h>
#include <string>

namespace audioscope {
namespace bindings {

/// Enumerate audio input (source) devices visible to the Android audio
/// framework, then merge USB-specific info from /proc/asound. Returns a JSON
/// array string:
///
///   [{"id":"12","name":"Built-in microphone","type":"builtin-mic",
///     "productName":"Built-in microphone","isDefault":true,
///     "sampleRates":[8000,16000,48000],"channels":[1,2],
///     "usbVendor":null,"usbProduct":null,"alsaCard":null}, ...]
///
/// `id` is the Oboe/AudioDeviceInfo id (pass it as the deviceId to
/// startCapture so Oboe routes to that device). `type` is a normalized label
/// (builtin-mic / wired-headset / wired-headphones / usb-device / usb-headset /
/// bluetooth-sco / bluetooth-a2dp / dock / hdmi / unknown). USB entries carry
/// the 16-bit vendor/product ids + ALSA card number when /proc/asound exposes
/// them.
///
/// The `context` jobject must be an android.content.Context (the
/// ReactApplicationContext passed from DspModule). On any JNI/filesystem error
/// the function returns "[]" rather than throwing.
std::string enumerate_input_devices(JNIEnv* env, jobject context);

} // namespace bindings
} // namespace audioscope
