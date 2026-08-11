// codec.c — external I2S codec driver (ESP-IDF driver/i2s_std.h).
//
// Target: PCM1802 ADC by default (a real 24-bit ADC), with a clean swap-point
// for UDA1334A / WM8731. The on-chip ESP32 ADC is too low-rate/noisy for scope
// use, so the codec is mandatory. Samples arrive as 24-bit-left-justified in
// a 32-bit word (S24); the host normalizes to float32 via convert_samples_to_f32.

#include "codec.h"
#include "board_config.h"
#include "generator.h"   // AS_USB_GEN_MAX_FREQ_HZ / _RESOLUTION_BITS

#include "esp_log.h"
#include "driver/i2s_std.h"

static const char* TAG = "audioscope.codec";
static i2s_chan_handle_t rx_chan = NULL;
static int g_rate = AUDIOSCOPE_DEFAULT_RATE;
static int g_channels = AUDIOSCOPE_DEFAULT_CHANNELS;
static size_t g_frame_bytes = 4;

esp_err_t codec_init(int port, int sample_rate, as_usb_sample_format fmt, int channels) {
    g_rate = sample_rate > 0 ? sample_rate : AUDIOSCOPE_DEFAULT_RATE;
    g_channels = channels > 0 ? channels : AUDIOSCOPE_DEFAULT_CHANNELS;

    i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(port, I2S_ROLE_MASTER);
    esp_err_t err = i2s_new_channel(&chan_cfg, NULL, &rx_chan);
    if (err != ESP_OK) { ESP_LOGE(TAG, "i2s_new_channel: %s", esp_err_to_name(err)); return err; }

    i2s_std_config_t std_cfg = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(g_rate),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
            fmt == AS_USB_FMT_S16 ? I2S_DATA_BIT_WIDTH_16BIT : I2S_DATA_BIT_WIDTH_24BIT,
            I2S_SLOT_MODE_MONO),  // capture is mono-focused
        .gpio_cfg = {
            .bclk = AUDIOSCOPE_I2S_BCLK,
            .ws   = AUDIOSCOPE_I2S_LRCK,
            .dout = -1,
            .din  = AUDIOSCOPE_I2S_DOUT,
            .mclk = AUDIOSCOPE_I2S_MCLK,
        },
    };
    err = i2s_channel_init_std_mode(rx_chan, &std_cfg);
    if (err != ESP_OK) { ESP_LOGE(TAG, "i2s init: %s", esp_err_to_name(err)); return err; }

    err = i2s_channel_enable(rx_chan);
    if (err != ESP_OK) { ESP_LOGE(TAG, "i2s enable: %s", esp_err_to_name(err)); return err; }

    g_frame_bytes = (fmt == AS_USB_FMT_S16 ? 2 : 4) * g_channels;
    ESP_LOGI(TAG, "codec ready: %d Hz, %d ch, frame=%u bytes",
             g_rate, g_channels, (unsigned)g_frame_bytes);
    return ESP_OK;
}

esp_err_t codec_set_rate(int sample_rate) {
    // Re-init is simplest on the S3 std driver; full reconfig is cheap.
    if (rx_chan) {
        i2s_channel_disable(rx_chan);
        i2s_del_channel(rx_chan);
        rx_chan = NULL;
    }
    return codec_init(AUDIOSCOPE_I2S_PORT, sample_rate,
                      AUDIOSCOPE_DEFAULT_FORMAT, g_channels);
}

size_t codec_read(void* buf, size_t max_frames, int timeout_ms) {
    if (!rx_chan || !buf || max_frames == 0) return 0;
    size_t want_bytes = max_frames * g_frame_bytes;
    size_t got_bytes = 0;
    esp_err_t err = i2s_channel_read(rx_chan, buf, want_bytes, &got_bytes, timeout_ms);
    if (err != ESP_OK) return 0;
    return got_bytes / g_frame_bytes;
}

size_t codec_frame_bytes(void) { return g_frame_bytes; }

void codec_bandwidth(as_usb_bandwidth_info* out) {
    if (!out) return;
    // PCM1802 datasheet: master clock up to 6.144 MHz → 96 kHz sample rate;
    // analog input bandwidth ~77 kHz (-3 dB); 3.2 Vpp full-scale; ~1.8 µV
    // input-referred noise; 24-bit. The generator limits come from generator.h.
    out->adc_max_rate = 96000u;
    out->analog_bw_hz = 77000u;
    out->effective_bw_hz = 48000u;   // min(96k/2, 77k)
    out->resolution_bits = 24u;
    out->vrange_mv = 3200u;
    out->noise_uv = 2u;
    out->gen_max_freq_hz = AS_USB_GEN_MAX_FREQ_HZ;
    out->gen_resolution_bits = AS_USB_GEN_RESOLUTION_BITS;
}
