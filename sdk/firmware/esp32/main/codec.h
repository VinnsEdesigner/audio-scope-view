// codec.h — external I2S codec abstraction (ESP-IDF driver/i2s_std).

#pragma once

#include "esp_err.h"
#include "usb_protocol.h"

#ifdef __cplusplus
extern "C" {
#endif

// Initialize the I2S peripheral + the chosen codec at the given rate/format.
// port: ESP I2S port number (0 or 1).
esp_err_t codec_init(int port, int sample_rate, as_usb_sample_format fmt, int channels);

// Reconfigure the sample rate without re-initing the whole codec.
esp_err_t codec_set_rate(int sample_rate);

// Read up to `max_frames` frames from the codec DMA into `buf`.
// Returns frames actually read (blocks until at least one frame or timeout).
size_t codec_read(void* buf, size_t max_frames, int timeout_ms);

// The byte width of one sample frame (channels * bytes/sample) after init.
size_t codec_frame_bytes(void);

// The codec's REAL analog/digital limits, so the host can present truthful
// scope ranges. PCM1802: 24-bit, 96 kHz max (digital), ~77 kHz analog BW,
// 3.2 Vpp full-scale, ~1.8 µV noise. Other codecs fill their own values.
void codec_bandwidth(as_usb_bandwidth_info* out);

#ifdef __cplusplus
}
#endif
