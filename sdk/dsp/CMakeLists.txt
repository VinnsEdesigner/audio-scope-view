add_library(audioscope_dsp STATIC
    src/dsp.cpp
    src/fft.cpp
    src/measurements.cpp
    src/spectrogram.cpp
    src/corrections.cpp
    src/trigger.cpp
    src/compression.cpp
    src/generators.cpp
)

target_include_directories(audioscope_dsp
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/../common/include
)

# Find liblz4 via pkg-config. The WASM/Android targets will later vendor a
# copy of the LZ4 C sources into sdk/dsp/third_party/ and define an lz4
# target here instead of relying on the system library.
find_package(PkgConfig QUIET)
set(AUDIOSCOPE_LZ4_TARGET "")
if(PkgConfig_FOUND)
    pkg_check_modules(LZ4 QUIET IMPORTED_TARGET liblz4)
    if(TARGET PkgConfig::LZ4)
        set(AUDIOSCOPE_LZ4_TARGET PkgConfig::LZ4)
    endif()
endif()
if(NOT AUDIOSCOPE_LZ4_TARGET)
    # Fallback: search the standard install location for the headers.
    find_path(LZ4_INCLUDE_DIR NAMES lz4.h)
    find_library(LZ4_LIBRARY NAMES lz4)
    if(LZ4_INCLUDE_DIR AND LZ4_LIBRARY)
        add_library(audioscope_lz4 STATIC IMPORTED)
        set_target_properties(audioscope_lz4 PROPERTIES
            IMPORTED_LOCATION "${LZ4_LIBRARY}")
        target_include_directories(audioscope_dsp PRIVATE "${LZ4_INCLUDE_DIR}")
        set(AUDIOSCOPE_LZ4_TARGET audioscope_lz4)
    endif()
endif()

target_link_libraries(audioscope_dsp
    PUBLIC
        audioscope_common
    PRIVATE
        ${AUDIOSCOPE_LZ4_TARGET}
)

set_target_properties(audioscope_dsp PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    CXX_VISIBILITY hidden
)
