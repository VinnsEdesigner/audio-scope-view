// usb_protocol.c — reference implementation of the shared USB protocol CRC.
//
// Pure C99, no platform deps — compiles under the ESP-IDF toolchain AND the
// host g++/clang, so firmware and host link the IDENTICAL CRC function and
// can never diverge. Both sides #include "usb_protocol.h" for the declaration
// and link this translation unit (or copy it) for the definition.

#include "usb_protocol.h"

uint16_t as_usb_crc16(const uint8_t* data, size_t len) {
    uint16_t crc = 0xFFFFu;
    for (size_t i = 0; i < len; ++i) {
        crc ^= (uint16_t)data[i] << 8;
        for (int b = 0; b < 8; ++b) {
            if (crc & 0x8000u) {
                crc = (uint16_t)((crc << 1) ^ 0x1021u);
            } else {
                crc = (uint16_t)(crc << 1);
            }
        }
    }
    return crc;
}
