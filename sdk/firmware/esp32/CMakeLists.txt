# sdk/firmware/esp32 — top-level ESP-IDF project.
#
# Builds the ESP32-S3 firmware that presents a CUSTOM vendor-class USB device
# (NOT UAC). The host talks to it directly via libusb (sdk/bindings/usb).
#
# Build:  idf.py build
# Flash:  idf.py flash monitor
#
# This is NOT part of the host `linux-bindings` CMake preset — ESP-IDF is a
# separate toolchain. It shares only usb_protocol.h with the host.

cmake_minimum_required(VERSION 3.16)

# Vendored real TinyUSB (upstream hathach/tinyusb) as a local component so
# the firmware builds offline without the IDF Component Registry.
set(EXTRA_COMPONENT_DIRS "${CMAKE_CURRENT_LIST_DIR}/components/tinyusb")

include($ENV{IDF_PATH}/tools/cmake/project.cmake OPTIONAL)

project(audioscope_esp32 C)

# When invoked by ESP-IDF (idf.py), IDF_PATH/project.cmake wires the component
# build. When opened in a plain CMake editor without ESP-IDF, the OPTIONAL
# include above silently no-ops so the tree is at least browseable.
