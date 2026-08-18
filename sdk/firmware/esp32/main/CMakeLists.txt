# sdk/firmware/esp32/main — the firmware component.

set(SRCS
    main.c
    usb_descriptors.c
    usb_device.c
    codec.c
    ring_buffer.c
    stream_task.c
    control_task.c
    generator.c)

idf_component_register(SRCS ${SRCS}
    INCLUDE_DIRS "." "${CMAKE_CURRENT_SOURCE_DIR}/../../../bindings/usb"
    REQUIRES tinyusb freertos esp_driver_i2s esp_driver_ledc esp_driver_gpio)

# usb_protocol.h is shared with the host — point INCLUDE_DIRS at it.
# tinyusb is the vendored real TinyUSB component (components/tinyusb).
# esp_driver_i2s  — codec.c (driver/i2s_std.h, PCM1802 capture).
# esp_driver_ledc — generator.c (driver/ledc.h, PWM signal generation).
# esp_driver_gpio — board pin mux.
