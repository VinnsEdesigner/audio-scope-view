# audioscope USB binding (host, libusb)

Host `AudioBinding` that talks to the ESP32 firmware **directly via libusb**,
bypassing the OS audio stack (ALSA / WASAPI / CoreAudio). This is the host
half of the "bare-USB" path; the device half is `sdk/firmware/esp32/`.

## What this is

Unlike the ALSA / PulseAudio / WASAPI / Oboe bindings (which bind to an OS
audio API), this binding opens the ESP32 by VID/PID over libusb and speaks
the custom audioscope USB protocol — see `docs/ESP32_USB_PROTOCOL.md`. It
implements the same `audioscope::bindings::AudioBinding` interface, so the
DSP core is agnostic to the transport.

## Why bare-USB instead of UAC
: a custom vendor-class device gives direct
processor communication, a real control surface (gain / sample rate /
channels) that UAC does not expose, lower latency, and no OS audio processing.
Tradeoff: the device needs this binding (or any libusb client) to read it; it
is not picked up by arbitrary DAWs/recorders.

## Host setup

```bash
# Linux (root not needed once udev rules are in place; see below)
sudo apt-get install libusb-1.0-0-dev pkg-config

# udev rule so that if you're a non-root user you can open the device:
echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="1209", ATTR{idProduct}=="a500", MODE="0666"' \
  | sudo tee /etc/udev/rules.d/99-audioscope.rules && sudo udevadm control --reload-rules
```

On Windows, install [libusb-win32](https://libusb.info/) (or WinUSB via Zadig)
for the `0x1209:0xA500` device. On macOS, `brew install libusb`.

## Build + test (host; no ESP32 needed)

The test runs with no hardware — libusb returns an empty device list on a
headless host, so `enumerate_devices()` is empty (not a failure) and a bogus
`start_capture()` returns false without crashing.

```bash
cd sdk
cmake --preset linux-bindings && cmake --build build/linux-bindings
ctest --preset linux-bindings     # 75/75 (61 core + 4 linux + 10 usb)
```

The USB test also asserts the wire-protocol struct sizes (16/16/64/4 bytes)
and the CRC-16 known vector, so a firmware/host drift fails the build.

## Files

| File | Purpose |
|---|---|
| `usb_protocol.h` / `.c` | shared wire protocol + CRC-16 (single source for firmware + host) |
| `usb_binding.h` | `extern "C"` factory decls (mirrors the other bindings) |
| `usb_binding.cpp` | `UsbCapture : AudioBinding` — libusb enumerate / control / bulk-IN → float32 |
| `CMakeLists.txt` | `audioscope_bindings_usb` static lib; gated on `pkg-config libusb-1.0` |
| `README.md` | this file |
