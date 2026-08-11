// main.c — audioscope ESP32-S3 firmware entry point.
//
// The device presents a CUSTOM vendor-class USB device (NOT UAC) so the host
// (sdk/bindings/usb/usb_binding.cpp) talks to the processor directly via
// libusb, bypassing the OS audio stack. app_main() initializes:
//   1. The USB device (TinyUSB vendor class + descriptors).
//   2. The external I2S codec (PCM1802/UDA1334A/WM8731).
//   3. The ring buffer bridging the I2S-DMA task to the USB bulk-IN task.
//   4. The control task (host commands: start/stop/set_rate/...).
//   5. The stream task (DMA-read codec -> ring -> USB bulk-IN).

#include <stdio.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_err.h"

#include "usb_device.h"
#include "codec.h"
#include "ring_buffer.h"
#include "stream_task.h"
#include "control_task.h"
#include "generator.h"
#include "board_config.h"

static const char* TAG = "audioscope.main";

void app_main(void) {
    ESP_LOGI(TAG, "audioscope ESP32-S3 firmware booting (bare-USB, NOT UAC)");

    // 1. Bring up USB first so the host sees the device early.
    if (usb_device_init() != ESP_OK) {
        ESP_LOGE(TAG, "USB init failed");
        return;
    }

    // 2. External I2S codec.
    if (codec_init(AUDIOSCOPE_I2S_PORT, AUDIOSCOPE_DEFAULT_RATE,
                   AUDIOSCOPE_DEFAULT_FORMAT, AUDIOSCOPE_DEFAULT_CHANNELS) != ESP_OK) {
        ESP_LOGE(TAG, "codec init failed");
        return;
    }

    // 3. Signal generator (PWM output, on the LEDC peripheral).
    generator_init(AUDIOSCOPE_GEN_GPIO);

    // 4. Ring between DMA-read task and USB bulk-IN task (~0.5s at 48kHz).
    ring_buffer_t* rb = ring_buffer_create(24000);
    if (!rb) {
        ESP_LOGE(TAG, "ring buffer OOM");
        return;
    }

    // 5-6. Start the control + stream tasks. The stream task waits on a flag
    //      the control task raises when the host sends START_STREAM.
    stream_task_start(rb);
    control_task_start(rb);

    ESP_LOGI(TAG, "ready. Waiting for host on VID/PID %04x/%04x",
             AUDIOSCOPE_USB_VID, AUDIOSCOPE_USB_PID);

    // app_main returns; FreeRTOS keeps the scheduler running.
}
