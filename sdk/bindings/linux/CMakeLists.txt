# sdk/bindings/linux — Linux audio capture bindings (ALSA + PulseAudio).
#
# Builds `audioscope_bindings_linux`: a static library containing the two
# AudioBinding implementations for Linux. Each implements the SAME
# audioscope::bindings::AudioBinding interface as the Android Oboe binding —
# only the platform audio API differs. The DSP core stays shared.
#
# This is the Linux analog of:
#   - sdk/bindings/android/CMakeLists.txt (Android, Oboe — single .so)
#   - sdk/bindings/windows/CMakeLists.txt (Windows, WASAPI)

cmake_minimum_required(VERSION 3.21)

# Root of the C++ SDK (../.. from here = sdk/).
get_filename_component(AUDIOSCOPE_SDK_ROOT
    "${CMAKE_CURRENT_SOURCE_DIR}/../.." ABSOLUTE)

find_package(PkgConfig QUIET)

# --- ALSA ---
pkg_check_modules(ALSA QUIET alsa)
add_library(audioscope_bindings_linux_alsa STATIC
    alsa_binding.cpp)
target_include_directories(audioscope_bindings_linux_alsa PUBLIC
    ${AUDIOSCOPE_SDK_ROOT}/common/include
    ${ALSA_INCLUDE_DIRS})
target_link_libraries(audioscope_bindings_linux_alsa PUBLIC
    audioscope_common ${ALSA_LIBRARIES})
set_target_properties(audioscope_bindings_linux_alsa PROPERTIES
    POSITION_INDEPENDENT_CODE ON)

# --- PulseAudio ---
# pa_simple_* live in libpulse-simple (a separate lib from libpulse).
# The simple-API reader links pulse-simple, which transitively pulls pulse.
pkg_check_modules(PULSE QUIET libpulse-simple)
add_library(audioscope_bindings_linux_pulse STATIC
    pulse_binding.cpp)
target_include_directories(audioscope_bindings_linux_pulse PUBLIC
    ${AUDIOSCOPE_SDK_ROOT}/common/include
    ${PULSE_INCLUDE_DIRS})
target_link_libraries(audioscope_bindings_linux_pulse PUBLIC
    audioscope_common ${PULSE_LIBRARIES})
set_target_properties(audioscope_bindings_linux_pulse PROPERTIES
    POSITION_INDEPENDENT_CODE ON)

# Aggregate target so a host links one name and gets both bindings.
add_library(audioscope_bindings_linux INTERFACE)
target_link_libraries(audioscope_bindings_linux INTERFACE
    audioscope_bindings_linux_alsa
    audioscope_bindings_linux_pulse)
