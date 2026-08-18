// usb_descriptors.c — TinyUSB device + configuration descriptors.
//
// CUSTOM vendor-class device (NOT UAC). The host identifies it by
// VID 0x1209 / PID 0xA500 and talks the audioscope wire protocol over:
//   - EP0 vendor control requests (control channel)
//   - bulk IN endpoint 0x81 (sample stream, device -> host)
//   - bulk OUT endpoint 0x01 (commands, host -> device, optional)

#include "tusb.h"
#include "usb_protocol.h"
#include "board_config.h"

// --- Device descriptor ---
tusb_desc_device_t const desc_device = {
    .bLength            = sizeof(tusb_desc_device_t),
    .bDescriptorType     = TUSB_DESC_DEVICE,
    .bcdUSB             = 0x0200,             // USB 2.0
    .bDeviceClass        = 0xFF,              // vendor-specific
    .bDeviceSubClass    = 0x00,
    .bDeviceProtocol    = 0x00,
    .bMaxPacketSize0    = 64,
    .idVendor           = AUDIOSCOPE_USB_VID,
    .idProduct          = AUDIOSCOPE_USB_PID,
    .bcdDevice          = 0x0100,
    .iManufacturer      = 0x01,
    .iProduct           = 0x02,
    .iSerialNumber      = 0x03,
    .bNumConfigurations = 0x01
};

uint8_t const* tud_descriptor_device_cb(void) {
    return (uint8_t const*)&desc_device;
}

// --- Configuration descriptor: interface 0, vendor class, 2 bulk EPs ---
#define CONFIG_TOTAL_LEN  (TUD_CONFIG_DESC_LEN + TUD_VENDOR_DESC_LEN)

uint8_t const desc_configuration[] = {
    TUD_CONFIG_DESCRIPTOR(1, 1, 0, CONFIG_TOTAL_LEN, TUSB_DESC_CONFIG_ATT_SELF_POWERED, 250),
    // Interface 0: vendor, 2 bulk endpoints. Both share the same EP size
    // (TUD_VENDOR_DESCRIPTOR takes itfnum, stridx, epout, epin, epsize).
    TUD_VENDOR_DESCRIPTOR(0, 0, AUDIOSCOPE_USB_EP_OUT, AUDIOSCOPE_USB_EP_IN,
                          AUDIOSCOPE_USB_EP_SIZE),
};

uint8_t const* tud_descriptor_configuration_cb(uint8_t index) {
    (void)index;
    return desc_configuration;
}

// --- String descriptors ---
char const* string_desc_arr[] = {
    (const char[]){0x09, 0x04},   // 0: English
    "audioscope",                  // 1: Manufacturer
    "audioscope USB scope",        // 2: Product
    "0"                            // 3: Serial
};

static uint16_t _desc_str[32];
uint16_t const* tud_descriptor_string_cb(uint8_t index, uint16_t langid) {
    (void)langid;
    uint8_t chr_count;
    if (index == 0) {
        memcpy(&_desc_str[1], string_desc_arr[0], 2);
        chr_count = 1;
    } else {
        if (index >= sizeof(string_desc_arr) / sizeof(string_desc_arr[0])) return NULL;
        const char* str = string_desc_arr[index];
        chr_count = (uint8_t)strlen(str);
        if (chr_count > 31) chr_count = 31;
        for (uint8_t i = 0; i < chr_count; i++) {
            _desc_str[1 + i] = str[i];
        }
    }
    _desc_str[0] = (TUSB_DESC_STRING << 8) | (2 * chr_count + 2);
    return _desc_str;
}
