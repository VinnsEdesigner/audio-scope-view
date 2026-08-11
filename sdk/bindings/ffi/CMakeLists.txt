# The FFI static library: a C ABI over the C++ DSP core. Linked into the Rust
# server (via build.rs cc compilation), WASM (emscripten exports), and Android
# JNI. Building standalone here lets CI verify the ABI compiles on every host.

add_library(audioscope_ffi STATIC audioscope_ffi.cpp)

target_include_directories(audioscope_ffi
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
    PRIVATE
        ${CMAKE_SOURCE_DIR}/dsp/include
        ${CMAKE_SOURCE_DIR}/common/include
)

target_link_libraries(audioscope_ffi
    PRIVATE
        audioscope_dsp
        audioscope_common
)

set_target_properties(audioscope_ffi PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    CXX_VISIBILITY hidden
    C_VISIBILITY hidden
)
