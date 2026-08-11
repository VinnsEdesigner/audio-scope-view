// usb_device.h — TinyUSB custom vendor-class device callbacks.

#pragma once

#include <stddef.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

esp_err_t usb_device_init(void);

// Called by the control task to enqueue a response on EP0.
void usb_device_send_response(const void* data, size_t len);

#ifdef __cplusplus
}
#endif
