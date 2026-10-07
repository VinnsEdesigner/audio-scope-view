# sdk/wasm/CMakeLists.txt — Emscripten WebAssembly target.
#
# Compiles the WASM entry point (emscripten_main.cpp) together with the FFI C
# ABI (audioscope_ffi.cpp) and the C++ DSP core into a single ES module:
#   audioscope.js + audioscope.wasm
# consumed by packages/dsp-wasm.
#
# The output target name is "audioscope"; Emscripten emits audioscope.js and
# audioscope.wasm next to it (overridden via OUTPUT_SUFFIX).

set(AUDIOSCOPE_WASM_SOURCES
    ${CMAKE_CURRENT_SOURCE_DIR}/emscripten_main.cpp
    ${CMAKE_SOURCE_DIR}/bindings/ffi/audioscope_ffi.cpp
)

add_library(audioscope_wasm STATIC ${AUDIOSCOPE_WASM_SOURCES})

target_include_directories(audioscope_wasm
    PUBLIC
        ${CMAKE_SOURCE_DIR}/bindings/ffi
    PRIVATE
        ${CMAKE_SOURCE_DIR}/dsp/include
        ${CMAKE_SOURCE_DIR}/common/include
)

target_link_libraries(audioscope_wasm
    PUBLIC
        audioscope_dsp
        audioscope_common
)

# Default visibility so the EMSCRIPTEN_KEEPALIVE exports survive the static
# archive into the final wasm-ld link (they have no C++ callers — JS calls
# them by name). The whole-archive link flag below guarantees the archive
# members are not discarded as dead code.
set_target_properties(audioscope_wasm PROPERTIES
    CXX_VISIBILITY default
    C_VISIBILITY default)

# Force-link the KEEPALIVE exports even though no C++ references them — JS
# calls them by name via the EXPORTED_FUNCTIONS list. Without this, the linker
# would strip them as dead code.
set(EM_EXPORT_NAMES
    "_malloc,_free,\
_em_free,_em_alloc,\
_em_fft_new,_em_fft_free,\
_em_compute_magnitudes,_em_find_peak_frequency,_em_compute_spectrum,_em_spectrum_free,\
_em_find_peak_amplitude,_em_find_negative_peak_amplitude,_em_compute_rms,\
_em_compute_dc_offset,_em_zero_crossing_rate,_em_estimate_dominant_frequency,\
_em_analyze_waveform,\
_em_amplitude_to_db,_em_db_to_amplitude,_em_peak_to_dbfs,_em_rms_to_dbfs,\
_em_dbfs_to_amplitude,_em_crest_factor_db,_em_snr_to_db,\
_em_analyze_harmonics,_em_harmonic_analysis_free,\
_em_compute_spectrogram,_em_spectrogram_free,\
_em_compress_waveform,_em_decompress_waveform,_em_compressed_waveform_free,\
_em_find_trigger,_em_triggered_window,_em_resample_to,\
_em_generate_waveform,\
_em_dsp_version"
)

# Build the final .js + .wasm via a POST_BUILD emcc link step. The static lib
# is just a compile vehicle; emcc produces the actual module from the link.
# --whole-archive keeps the EMSCRIPTEN_KEEPALIVE exports (no C++ callers).
add_custom_command(TARGET audioscope_wasm POST_BUILD
    COMMAND
        ${CMAKE_CXX_COMPILER}
        -Wl,--whole-archive $<TARGET_FILE:audioscope_wasm> -Wl,--no-whole-archive
        $<TARGET_FILE:audioscope_dsp>
        $<TARGET_FILE:audioscope_common>
        $<TARGET_FILE:audioscope_lz4_vendored>
        -o ${CMAKE_CURRENT_BINARY_DIR}/audioscope.js
        -O3
        -msimd128
        -s WASM=1
        -s MODULARIZE=1
        -s EXPORT_ES6=1
        -s ENVIRONMENT=web,worker,node
        -s ALLOW_MEMORY_GROWTH=1
        -s EXPORT_NAME=AudioScopeDspModule
        -s EXPORTED_FUNCTIONS=${EM_EXPORT_NAMES}
        -s EXPORTED_RUNTIME_METHODS=["ccall","cwrap","HEAPF32","HEAPU8","HEAPU32","getValue","setValue"]
        --no-entry
        -L${CMAKE_CURRENT_BINARY_DIR}
    COMMAND ${CMAKE_COMMAND} -E echo "Built audioscope.js + audioscope.wasm"
    BYPRODUCTS
        ${CMAKE_CURRENT_BINARY_DIR}/audioscope.wasm
        ${CMAKE_CURRENT_BINARY_DIR}/audioscope.wasm.map
    WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
    COMMENT "Linking WebAssembly module (audioscope.js + audioscope.wasm)"
)
