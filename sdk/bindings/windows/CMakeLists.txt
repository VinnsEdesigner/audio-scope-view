# sdk/bindings/windows — Windows audio capture binding (WASAPI).
#
# Builds `audioscope_bindings_windows`: a static library containing the
# WASAPI AudioBinding implementation. Only added to the build on Windows
# (guarded by `if(WIN32)` in sdk/CMakeLists.txt). The DSP core stays shared.
#
# This is the Windows analog of:
#   - sdk/bindings/linux/CMakeLists.txt (Linux, ALSA + PulseAudio)
#   - sdk/bindings/android/CMakeLists.txt (Android, Oboe)

cmake_minimum_required(VERSION 3.21)

get_filename_component(AUDIOSCOPE_SDK_ROOT
    "${CMAKE_CURRENT_SOURCE_DIR}/../.." ABSOLUTE)

add_library(audioscope_bindings_windows STATIC
    wasapi_binding.cpp)
target_include_directories(audioscope_bindings_windows PUBLIC
    ${AUDIOSCOPE_SDK_ROOT}/common/include)
# WASAPI needs ole32 (CoInitialize) + the Windows SDK (atlbase, mmdeviceapi).
target_link_libraries(audioscope_bindings_windows PUBLIC
    audioscope_common ole32)
set_target_properties(audioscope_bindings_windows PROPERTIES
    POSITION_INDEPENDENT_CODE ON)
