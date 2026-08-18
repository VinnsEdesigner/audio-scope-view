# sdk/bindings/android — JSI C++ DSP module for Android.
#
# Builds libaudioscope_dsp.so: the C++ DSP core (sdk/dsp) + shared primitives
# (sdk/common) + the C ABI (sdk/bindings/ffi) + the JNI bridge (jni_bridge.cpp)
# + the Oboe capture binding (oboe_capture.cpp). The .so is loaded from Java/Kotlin
# by DspModule (a JSI TurboModule) which calls the extern "C" exports below.
#
# This is the Android analog of:
#   - sdk/wasm/emscripten_main.cpp  (the WASM/JS host)
#   - rust/src/infrastructure/dsp_ffi.rs (the Rust server host)
# All three bind to the SAME flat C ABI in sdk/bindings/ffi/audioscope_ffi.h.

cmake_minimum_required(VERSION 3.22.1)

project(audioscope_android LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Root of the C++ SDK (../.. from here = sdk/).
get_filename_component(AUDIOSCOPE_SDK_ROOT
    "${CMAKE_CURRENT_SOURCE_DIR}/../.." ABSOLUTE)

# --- C++ DSP core (static, built from source so the NDK cross-compiles it) ---
add_library(audioscope_dsp_core STATIC
    ${AUDIOSCOPE_SDK_ROOT}/dsp/src/dsp.cpp
    ${AUDIOSCOPE_SDK_ROOT}/dsp/src/fft.cpp
    ${AUDIOSCOPE_SDK_ROOT}/dsp/src/measurements.cpp
    ${AUDIOSCOPE_SDK_ROOT}/dsp/src/spectrogram.cpp
    ${AUDIOSCOPE_SDK_ROOT}/dsp/src/corrections.cpp
    ${AUDIOSCOPE_SDK_ROOT}/dsp/src/trigger.cpp
    ${AUDIOSCOPE_SDK_ROOT}/dsp/src/compression.cpp
    ${AUDIOSCOPE_SDK_ROOT}/dsp/src/generators.cpp
)
target_include_directories(audioscope_dsp_core PUBLIC
    ${AUDIOSCOPE_SDK_ROOT}/dsp/include
    ${AUDIOSCOPE_SDK_ROOT}/common/include)
# LZ4 is vendored under sdk/dsp/third_party/lz4 — self-contained on Android.
add_library(audioscope_lz4_vendored STATIC
    ${AUDIOSCOPE_SDK_ROOT}/dsp/third_party/lz4/lz4.c)
target_include_directories(audioscope_lz4_vendored PUBLIC
    ${AUDIOSCOPE_SDK_ROOT}/dsp/third_party/lz4)
target_link_libraries(audioscope_dsp_core PUBLIC audioscope_lz4_vendored)

# --- Shared primitives (common) ---
add_library(audioscope_common STATIC
    ${AUDIOSCOPE_SDK_ROOT}/common/src/buffer.cpp
    ${AUDIOSCOPE_SDK_ROOT}/common/src/config.cpp
    ${AUDIOSCOPE_SDK_ROOT}/common/src/types.cpp)
target_include_directories(audioscope_common PUBLIC
    ${AUDIOSCOPE_SDK_ROOT}/common/include)

# --- C ABI over the core ---
add_library(audioscope_ffi STATIC
    ${AUDIOSCOPE_SDK_ROOT}/bindings/ffi/audioscope_ffi.cpp)
target_include_directories(audioscope_ffi PUBLIC
    ${AUDIOSCOPE_SDK_ROOT}/bindings/ffi)
target_link_libraries(audioscope_ffi PUBLIC audioscope_dsp_core audioscope_common)


# (sdk/build/linux ctest) which never touches oboe.
include(FetchContent)
FetchContent_Declare(
    oboe
    GIT_REPOSITORY https://github.com/google/oboe.git
    GIT_TAG        1.9.0
    GIT_SHALLOW    ON
)
# FetchContent_MakeAvailable runs oboe's root CMakeLists only, which builds the
# oboe library target — the apps/ and tests/ subdirs are never entered, so
# oboe's sample/test-app sources (the ~1000 files we don't link) are skipped.
FetchContent_MakeAvailable(oboe)

# --- JNI bridge + Oboe capture binding + device enumeration → the shared lib the app packages ---
add_library(audioscope_dsp SHARED
    jni_bridge.cpp
    oboe_capture.cpp
    device_enumeration.cpp
)

# JNI headers ship with the NDK.
find_library(log-lib log)

target_include_directories(audioscope_dsp PRIVATE
    ${AUDIOSCOPE_SDK_ROOT}/bindings/ffi
    ${AUDIOSCOPE_SDK_ROOT}/common/include
    ${AUDIOSCOPE_SDK_ROOT}/dsp/include
    ${oboe_SOURCE_DIR}/include)

target_link_libraries(audioscope_dsp
    audioscope_ffi
    audioscope_dsp_core
    audioscope_common
    oboe
    ${log-lib}
)

# Keep the JNI exports visible (extern "C" + linker version script).
set_target_properties(audioscope_dsp PROPERTIES
    CXX_VISIBILITY default
    C_VISIBILITY default)
target_link_options(audioscope_dsp PRIVATE
    "-Wl,--version-script=${CMAKE_CURRENT_SOURCE_DIR}/exports.version")
