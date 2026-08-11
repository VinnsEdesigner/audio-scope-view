add_library(audioscope_common STATIC
    src/buffer.cpp
    src/config.cpp
)

target_include_directories(audioscope_common
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
)

set_target_properties(audioscope_common PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    CXX_VISIBILITY hidden
)
