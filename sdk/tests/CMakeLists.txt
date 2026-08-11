# GoogleTest is provided by the system (libgtest-dev) or fetched via
# FetchContent when not present. Tests are kept out of the WASM/Android/FFI
# builds via the AUDIOSCOPE_BUILD_TESTS option.
include(FetchContent)
include(GoogleTest)

find_package(GTest QUIET)
if(NOT GTest_FOUND)
    FetchContent_Declare(
        googletest
        URL https://github.com/google/googletest/archive/refs/tags/v1.14.0.tar.gz
    )
    set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
    FetchContent_MakeAvailable(googletest)
    set(GTEST_LIB gtest gtest_main)
    set(GTEST_INCLUDE_DIR "")
else()
    set(GTEST_LIB GTest::gtest GTest::gtest_main)
    set(GTEST_INCLUDE_DIR "")
endif()

set(AUDIOSCOPE_TESTS
    test_fft
    test_measurements
    test_spectrogram
    test_corrections
    test_trigger
    test_compression
    test_generators
    test_common
)

# The platform bindings smoke test links the ALSA + PulseAudio AudioBinding
# factories — only add it when the bindings are built (linux-bindings preset
# or AUDIOSCOPE_BUILD_BINDINGS=ON on Linux).
if(AUDIOSCOPE_BUILD_BINDINGS AND UNIX AND NOT APPLE)
    list(APPEND AUDIOSCOPE_TESTS test_bindings)
endif()

# The libusb (bare-ESP32) binding test links audioscope_bindings_usb. It's
# cross-platform (gated on libusb, not on the host OS) — so it runs on Linux,
# Windows, and macOS whenever libusb-1.0 is present.
find_package(PkgConfig QUIET)
if(PkgConfig_FOUND)
    pkg_check_modules(LIBUSB QUIET libusb-1.0)
endif()
if(AUDIOSCOPE_BUILD_BINDINGS AND LIBUSB_FOUND)
    list(APPEND AUDIOSCOPE_TESTS test_usb_binding)
endif()

foreach(test ${AUDIOSCOPE_TESTS})
    add_executable(${test} ${test}.cpp)
    # test_common exercises only the common infrastructure (ring buffer, pool,
    # config, sample-format conversion); it links audioscope_common directly.
    # test_bindings links the Linux platform bindings (ALSA + PulseAudio) when
    # AUDIOSCOPE_BUILD_BINDINGS is on. The rest link the DSP core (which itself
    # depends on common transitively).
    if(test STREQUAL "test_common")
        target_link_libraries(${test}
            PRIVATE
                audioscope_common
                ${GTEST_LIB}
        )
    elseif(test STREQUAL "test_bindings")
        target_link_libraries(${test}
            PRIVATE
                audioscope_bindings_linux
                ${GTEST_LIB}
        )
    elseif(test STREQUAL "test_usb_binding")
        target_link_libraries(${test}
            PRIVATE
                audioscope_bindings_usb
                ${GTEST_LIB}
        )
    else()
        target_link_libraries(${test}
            PRIVATE
                audioscope_dsp
                ${GTEST_LIB}
        )
    endif()
    target_include_directories(${test}
        PRIVATE
            ${CMAKE_SOURCE_DIR}/dsp/include
            ${CMAKE_SOURCE_DIR}/common/include
            ${GTEST_INCLUDE_DIR}
    )
    gtest_discover_tests(${test})
endforeach()
