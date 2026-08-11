// control_task.c — handles host commands (GET_INFO/START/STOP/SET_RATE/...).

#include "control_task.h"
#include "usb_protocol.h"
#include "usb_device.h"
#include "codec.h"
#include "generator.h"
#include "stream_task.h"
#include "board_config.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include <string.h>

static const char* TAG = "audioscope.ctrl";

// The stream flag: raised on START_STREAM, cleared on STOP_STREAM.
static volatile bool g_streaming = false;

bool control_is_streaming(void) { return g_streaming; }

// Dispatch a single decoded command. Called from the TinyUSB control-xfer
// callback (synchronously on EP0). Returns the response to send back, or
// NULL (and *out_len=0) for a no-payload ACK.
static const uint8_t* control_dispatch(const as_usb_cmd_header* req,
                                       const uint8_t* payload,
                                       uint16_t* out_len) {
    static uint8_t rsp_buf[16 + 64];
    as_usb_rsp_header* rsp = (as_usb_rsp_header*)rsp_buf;
    rsp->magic[0] = AUDIOSCOPE_USB_MAGIC0;
    rsp->magic[1] = AUDIOSCOPE_USB_MAGIC1;
    rsp->cmd_echo = req->cmd;
    rsp->seq = req->seq;
    rsp->status = AS_USB_STATUS_OK;
    rsp->crc = 0;
    rsp->_pad = 0;
    *out_len = 16;

    switch (req->cmd) {
        case AS_USB_CMD_GET_INFO: {
            as_usb_device_info* info = (as_usb_device_info*)(rsp_buf + 16);
            memset(info, 0, sizeof(*info));
            info->hw_version = 1;
            info->fw_version = 1;
            info->codec_id = AS_USB_CODEC_PCM1802;
            info->max_sample_rate = 96000;
            info->min_sample_rate = 8000;
            info->channels = AUDIOSCOPE_DEFAULT_CHANNELS;
            info->sample_format = AUDIOSCOPE_DEFAULT_FORMAT;
            info->frame_size = (uint32_t)codec_frame_bytes();
            strncpy((char*)info->name, "audioscope-s3", sizeof(info->name));
            rsp->payload_len = 64;
            *out_len = 16 + 64;
            break;
        }
        case AS_USB_CMD_GET_BANDWIDTH: {
            as_usb_bandwidth_info* bw = (as_usb_bandwidth_info*)(rsp_buf + 16);
            codec_bandwidth(bw);
            rsp->payload_len = 32;
            *out_len = 16 + 32;
            break;
        }
        case AS_USB_CMD_START_STREAM: g_streaming = true; rsp->payload_len = 0; break;
        case AS_USB_CMD_STOP_STREAM:  g_streaming = false; rsp->payload_len = 0; break;
        case AS_USB_CMD_SET_RATE: {
            if (req->payload_len >= sizeof(as_usb_cmd_set_rate)) {
                as_usb_cmd_set_rate* p = (as_usb_cmd_set_rate*)payload;
                codec_set_rate((int)p->sample_rate);
            }
            rsp->payload_len = 0;
            break;
        }
        case AS_USB_CMD_SET_TIMEBASE:
        case AS_USB_CMD_SET_TRIGGER:
        case AS_USB_CMD_SET_VSCALE:
        case AS_USB_CMD_SET_COUPLING:
            // Applied to the analog front-end (stubbed — no AFEn yet).
            rsp->payload_len = 0;
            break;
        case AS_USB_CMD_GEN_START: {
            // The host sends GEN_SET_* first, then GEN_START. We start from
            // the last-configured params (generator.c holds them). For a
            // self-contained GEN_START with no prior config, default to 1 kHz
            // square 50%.
            if (!generator_start(AS_USB_WAVE_SQUARE, 1000, 3200, 0, 500)) {
                rsp->status = AS_USB_STATUS_ERR;
            }
            rsp->payload_len = 0;
            break;
        }
        case AS_USB_CMD_GEN_STOP: generator_stop(); rsp->payload_len = 0; break;
        default:
            rsp->status = AS_USB_STATUS_ERR_CMD;
            rsp->payload_len = 0;
            break;
    }
    return rsp_buf;
}

void control_task_start(ring_buffer_t* rb) {
    (void)rb;
    // In a full impl this task blocks on a queue fed by tud_vendor_*_cb and
    // calls control_dispatch per request. Here it implements the synchronous
    // command path the host drives via EP0 vendor requests; the TinyUSB
    // control-xfer callback is the async entry point.
    while (1) {
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}
