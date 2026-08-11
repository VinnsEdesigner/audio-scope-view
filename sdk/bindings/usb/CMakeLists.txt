# sdk/bindings/usb — host AudioBinding over libusb (the "bare" ESP32 path).
#
# Builds `audioscope_bindings_usb`: a static library containing the libusb
# AudioBinding. This binding talks the custom audioscope USB vendor-class
# protocol DIRECTLY — it does NOT go through ALSA/WASAPI/CoreAudio. The ESP32
# firmware (sdk/firmware/esp32) is the matching device side.
#
# Cross-platform: libusb-1.0 works on Linux, Windows, and macOS, so this
# binding is NOT OS-gated (unlike bindings/linux which needs ALSA, or
# bindings/windows which needs WASAPI). It's gated on libusb presence only.

cmake_minimum_required(VERSION 3.21)

get_filename_component(AUDIOSCOPE_SDK_ROOT
    "${CMAKE_CURRENT_SOURCE_DIR}/../.." ABSOLUTE)

find_package(PkgConfig QUIET)
pkg_check_modules(LIBUSB REQUIRED libusb-1.0)

# Shared wire protocol (compiled once; firmware links its own copy).
add_library(audioscope_usb_protocol STATIC
    usb_protocol.c)
target_include_directories(audioscope_usb_protocol PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR})

# The libusb AudioBinding.
add_library(audioscope_bindings_usb STATIC
    usb_binding.cpp)
target_include_directories(audioscope_bindings_usb PUBLIC
    ${AUDIOSCOPE_SDK_ROOT}/common/include
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${LIBUSB_INCLUDE_DIRS})
target_link_libraries(audioscope_bindings_usb PUBLIC
    audioscope_common
    audioscope_usb_protocol
    ${LIBUSB_LIBRARIES})
set_target_properties(audioscope_bindings_usb PROPERTIES
    POSITION_INDEPENDENT_CODE ON)
