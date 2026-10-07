// stream_task.c — the sample-pump task.
//
// Loops: codec_read() -> ring_buffer_write() while streaming; a separate
// USB-send path drains the ring onto the bulk-IN endpoint. The streaming
// flag is owned by the control task (control_is_streaming()).

#include "stream_task.h"
#include "control_task.h"
#include "codec.h"
#include "usb_protocol.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "tusb.h"
#include "esp_log.h"
#include "board_config.h"

static const char* TAG = "audioscope.stream";

#define AUDIOSCOPE_DMA_FRAMES 256

static void stream_task(void* arg) {
    ring_buffer_t* rb = (ring_buffer_t*)arg;
    static uint8_t dma_buf[AUDIOSCOPE_DMA_FRAMES * 4];  // 4 bytes/frame max
    for (;;) {
        if (!control_is_streaming()) {
            vTaskDelay(pdMS_TO_TICKS(10));
            continue;
        }
        size_t got = codec_read(dma_buf, AUDIOSCOPE_DMA_FRAMES, 100);
        if (got) {
            ring_buffer_write(rb, dma_buf, got);

            // Drain the ring onto the USB bulk-IN endpoint, framed with the
            // stream header (magic + count) the host expects.
            uint8_t pkt[AUDIOSCOPE_USB_MAX_PACKET];
            as_usb_stream_header* sh = (as_usb_stream_header*)pkt;
            size_t avail = ring_buffer_available(rb);
            size_t to_send = avail;
            if (to_send * codec_frame_bytes() > AUDIOSCOPE_USB_MAX_PACKET - sizeof(*sh)) {
                to_send = (AUDIOSCOPE_USB_MAX_PACKET - sizeof(*sh)) / codec_frame_bytes();
            }
            if (to_send == 0) continue;
            sh->magic = AS_USB_STREAM_MAGIC;
            sh->sample_count = (uint16_t)to_send;
            ring_buffer_read(rb, pkt + sizeof(*sh), to_send);
            //tud_vendor_write(pkt, sizeof(*sh) + to_send * codec_frame_bytes());
        }
    }
}

void stream_task_start(ring_buffer_t* rb) {
    xTaskCreate(stream_task, "audioscope_stream", 8192, rb, 5, NULL);
    ESP_LOGI(TAG, "stream task started");
}
