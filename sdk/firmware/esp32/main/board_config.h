// board_config.h — ESP32-S3 pin map for the audioscope codec.
//
// Pin assignments for the external I2S codec. Override per-board at build
// time. Default: PCM1802 ADC on standard I2S.

#pragma once

#include "sdkconfig.h"

// I2S peripheral instance (ESP32-S3 has I2S0 + I2S1; use 0 by default).
#define AUDIOSCOPE_I2S_PORT 0

// I2S data/clock pins (GPIO numbers). PCM1802 wiring:
//   MCLK  <- (codec self-clock or not used)
//   BCLK  <- GPIO 4   (bit clock)
//   LRCK  <- GPIO 5   (L/R select / WS)
//   DOUT  -> GPIO 6   (ADC data IN to the ESP32)
#define AUDIOSCOPE_I2S_BCLK  4
#define AUDIOSCOPE_I2S_LRCK  5
#define AUDIOSCOPE_I2S_DOUT  6
#define AUDIOSCOPE_I2S_MCLK  -1   // -1 = not used

// Default codec. 0 = UDA1334A, 1 = PCM1802, 2 = WM8731 (see usb_protocol.h).
#define AUDIOSCOPE_CODEC_ID 1

// Default sample rate + format the firmware offers to the host.
#define AUDIOSCOPE_DEFAULT_RATE   48000
#define AUDIOSCOPE_DEFAULT_FORMAT AS_USB_FMT_S24
#define AUDIOSCOPE_DEFAULT_CHANNELS 1

// USB endpoint config (must match host usb_binding.cpp).
#define AUDIOSCOPE_USB_EP_IN  0x81   // bulk IN  (device -> host samples)
#define AUDIOSCOPE_USB_EP_OUT 0x01   // bulk OUT (host -> device commands, optional)
#define AUDIOSCOPE_USB_MAX_PACKET 512

// Signal generator output (LEDC PWM). GPIO 7 on the S3 DevKit — pick a pin
// that's not used by USB/JTAG/strapping/flash.
#define AUDIOSCOPE_GEN_GPIO 7
