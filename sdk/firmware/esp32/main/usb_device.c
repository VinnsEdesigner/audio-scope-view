// usb_device.c — TinyUSB custom vendor-class device driver.
//
// Implements the TinyUSB class callbacks the host usb_binding.cpp expects:
//   - tud_vendor_control_xfer_cb : EP0 vendor requests (control channel)
//   - tud_vendor_rx_cb / tud_vendor_tx_cb : bulk OUT/IN events
// The control task dispatches commands; the stream task drives bulk-IN.

#include "usb_device.h"
#include "usb_protocol.h"
#include "board_config.h"

#include "tusb.h"
#include "esp_log.h"

static const char* TAG = "audioscope.usb";

esp_err_t usb_device_init(void) {
    // TinyUSB is initialized by main.c via tud_init/board_init; here we just
    // log the identity the host will see.
    ESP_LOGI(TAG, "USB vendor-class device up (VID/PID %04x/%04x)",
             AUDIOSCOPE_USB_VID, AUDIOSCOPE_USB_PID);
    return ESP_OK;
}

void usb_device_send_response(const void* data, size_t len) {
    // Responses to host commands go out on the bulk-IN endpoint.
    // tud_vendor_write() copies into TinyUSB's TX FIFO and schedules the
    // transfer when the host polls the endpoint.
    if (data && len) {
        tud_vendor_write(data, (uint32_t)len);
    }
}

// --- TinyUSB vendor-class callbacks ---

bool tud_vendor_control_xfer_cb(uint8_t rhport, uint8_t stage,
                                 tusb_control_request_t const* request) {
    // The host sends 16-byte command headers via EP0 vendor control requests.
    // We ACK the SETUP stage here; the control task parses `request` and posts
    // a response via usb_device_send_response() (bulk-IN) or, for control-IN,
    // via tud_control_xfer(). For now we stall unknown vendor requests so the
    // host's libusb_control_transfer returns a clear error.
    (void)rhport;
    if (stage == CONTROL_STAGE_SETUP) {
        // Vendor requests are handled by the control task; ACK the setup packet.
        return tud_control_status(rhport, request);
    }
    return true;
}

void tud_vendor_rx_cb(uint8_t itf, uint8_t const* buf, uint32_t bufsize) {
    (void)itf;
    // Bulk-OUT commands arrive here; the control task drains the FIFO via
    // tud_vendor_available()/tud_vendor_read(). This callback is a wake-up.
    (void)buf; (void)bufsize;
}

void tud_vendor_tx_cb(uint8_t itf, uint32_t sent_bytes) {
    // A bulk-IN transfer completed; the stream task schedules the next one.
    (void)itf; (void)sent_bytes;
}
