cmake_minimum_required(VERSION 3.21)

project(
    audioscope_sdk
    VERSION 0.1.1
    LANGUAGES C CXX
)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

option(AUDIOSCOPE_BUILD_TESTS "Build GoogleTest unit tests" ON)
option(AUDIOSCOPE_BUILD_BINDINGS "Build platform audio bindings" OFF)
option(AUDIOSCOPE_BUILD_WASM "Build WebAssembly target (Emscripten)" OFF)
option(AUDIOSCOPE_BUILD_FFI "Build FFI bridge object for Rust" OFF)

add_subdirectory(common)
add_subdirectory(dsp)

if(AUDIOSCOPE_BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()

if(AUDIOSCOPE_BUILD_BINDINGS)
    # Each platform binding is only added on its own host OS — the ALSA/
    # PulseAudio sources need <alsa/asoundlib.h>/<pulse/simple.h> (Linux),
    # the WASAPI sources need <mmdeviceapi.h>/ole32 (Windows), and the Oboe/
    # JNI sources need the NDK (Android cross-compile). A desktop native
    # client links the platform-appropriate target only.
    #
    # The usb binding is the exception: it's cross-platform (libusb works on
    # Linux/Win/macOS) and talks the ESP32 directly via libusb — NOT through
    # the OS audio stack. It's gated on libusb presence, not on the host OS.
    if(UNIX AND NOT APPLE)
        add_subdirectory(bindings/linux)
    endif()
    if(WIN32)
        add_subdirectory(bindings/windows)
    endif()
    find_package(PkgConfig QUIET)
    if(PkgConfig_FOUND)
        pkg_check_modules(LIBUSB QUIET libusb-1.0)
    endif()
    if(LIBUSB_FOUND)
        add_subdirectory(bindings/usb)
    endif()
    # The Android binding is built by its own CMake (the Gradle NDK build
    # drives sdk/bindings/android/CMakeLists.txt directly via the NDK
    # toolchain — see apps/vyzorMobile/android/app/build.gradle). It is NOT
    # part of the host `linux-bindings` preset.
endif()

if(AUDIOSCOPE_BUILD_FFI)
    add_subdirectory(bindings/ffi)
endif()

if(AUDIOSCOPE_BUILD_WASM)
    add_subdirectory(wasm)
endif()
