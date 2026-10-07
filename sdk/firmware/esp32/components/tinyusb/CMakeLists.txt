# Local vendored TinyUSB component (upstream hathach/tinyusb source).
# Registered as an EXTRA_COMPONENT_DIRS entry from the top-level CMakeLists.txt.
idf_component_register(
    SRCS
        "src/tusb.c"
        "src/common/tusb_fifo.c"
        "src/class/vendor/vendor_device.c"
        "src/portable/synopsys/dwc2/dcd_dwc2.c"
        "src/portable/synopsys/dwc2/dwc2_common.c"
    INCLUDE_DIRS
        "."
        "src"
    REQUIRES
        "freertos"
)
target_compile_definitions(${COMPONENT_LIB} PUBLIC
    CFG_TUSB_MCU=OPT_MCU_ESP32S3
    CFG_TUSB_OS=OPT_OS_FREERTOS
    # ESP-IDF's FreeRTOS headers live under include/freertos/, so prefix
    # the bare includes TinyUSB's osal expects.
    CFG_TUSB_OS_INC_PATH=freertos/
)
