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
    add_subdirectory(bindings/linux)
    add_subdirectory(bindings/windows)
    add_subdirectory(bindings/android)
endif()

if(AUDIOSCOPE_BUILD_FFI)
    add_subdirectory(bindings/ffi)
endif()

if(AUDIOSCOPE_BUILD_WASM)
    add_subdirectory(wasm)
endif()
