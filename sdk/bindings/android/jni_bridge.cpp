// jni_bridge.cpp — JNI bridge between the Java/Kotlin JSI TurboModule
// (com.audioscope.dsp.DspModule) and the C++ DSP core via the flat C ABI in
// sdk/bindings/ffi/audioscope_ffi.h.
//
// This is the Android analog of:
//   - sdk/wasm/emscripten_main.cpp   (the WASM host)
//   - rust/src/infrastructure/dsp_ffi.rs (the Rust server host)
// All three bind to the SAME C ABI; the C++ classes stay inside the C++ ABI.
//
// Export surface (Java_com_audioscope_dsp_DspModule_*):
//   long  nativeCreate()                              → as_fft_new
//   void  nativeDestroy(long handle)                  → as_fft_free
//   float[] nativeComputeMagnitudes(long, float[], float rate) → as_fft_compute_magnitudes
//   float[] nativeMeasurements(long, float[], float rate)     → as_analyze_waveform (9 fields)
//   float[] nativeComputeSpectrum(long, float[], float rate, int window) → as_fft_compute_spectrum
//
// Memory: malloc'd asf32_array.data is copied into a new JNI jfloatArray and
// freed with asf32_array_free before returning — the Java side owns a copy,
// the C++ side owns nothing across the call. This matches the WASM/Rust hosts.

#include "audioscope_ffi.h"
#include "audioscope/common/audio_binding.hpp"
#include "device_enumeration.h"

#include <jni.h>
#include <cstdint>
#include <cstring>
#include <new>
#include <vector>

// Capture binding factory/destroyer implemented in oboe_capture.cpp.
// extern "C" to match the definitions (C linkage, unmangled names).
extern "C" {
audioscope::bindings::AudioBinding* audioscope_android_binding_create();
void audioscope_android_binding_destroy(audioscope::bindings::AudioBinding*);
}

namespace {
inline AudioscopeFft* handle(jlong h) {
    return reinterpret_cast<AudioscopeFft*>(static_cast<uintptr_t>(h));
}

// Copy a C asf32_array into a freshly-allocated jfloatArray, then free the C
// buffer. Returns an empty (non-null) jfloatArray if `a` is empty.
jfloatArray to_jfloats(JNIEnv* env, asf32_array a) {
    jsize len = static_cast<jsize>(a.len);
    jfloatArray out = env->NewFloatArray(len > 0 ? len : 1);
    if (out == nullptr) {
        asf32_array_free(a);
        return nullptr;  // OOM thrown.
    }
    if (len > 0) {
        env->SetFloatArrayRegion(out, 0, len, a.data);
    }
    asf32_array_free(a);
    return out;
}

// Read a jfloatArray into a temporary std::vector<float> for the C ABI.
std::vector<float> from_jfloats(JNIEnv* env, jfloatArray in) {
    jsize len = env->GetArrayLength(in);
    std::vector<float> v(static_cast<size_t>(len));
    if (len > 0) {
        env->GetFloatArrayRegion(in, 0, len, v.data());
    }
    return v;
}
}  // namespace

extern "C" {

// JNI_OnLoad is optional; the version script still exports it so the loader
// reports the required JNI version. We return JNI_VERSION_1_6.
JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* /*vm*/, void* /*reserved*/) {
    return JNI_VERSION_1_6;
}

JNIEXPORT jlong JNICALL
Java_com_audioscope_dsp_DspModule_nativeCreate(JNIEnv* /*env*/, jclass /*klass*/) {
    AudioscopeFft* fft = as_fft_new();
    return static_cast<jlong>(reinterpret_cast<uintptr_t>(fft));
}

JNIEXPORT void JNICALL
Java_com_audioscope_dsp_DspModule_nativeDestroy(JNIEnv* /*env*/, jclass /*klass*/, jlong h) {
    as_fft_free(handle(h));
}

JNIEXPORT jfloatArray JNICALL
Java_com_audioscope_dsp_DspModule_nativeComputeMagnitudes(
    JNIEnv* env, jclass /*klass*/, jlong h, jfloatArray samples, jfloat sampleRate) {
    auto s = from_jfloats(env, samples);
    asf32_array m = as_fft_compute_magnitudes(handle(h), s.data(), s.size(), sampleRate);
    return to_jfloats(env, m);
}

// Returns the 9 as_waveform_analysis fields packed into a float[9]:
//   [peak, negPeak, rms, dc, crest, zcr, domFreq, thd, snr]
JNIEXPORT jfloatArray JNICALL
Java_com_audioscope_dsp_DspModule_nativeMeasurements(
    JNIEnv* env, jclass /*klass*/, jlong /*h*/, jfloatArray samples, jfloat sampleRate) {
    auto s = from_jfloats(env, samples);
    as_waveform_analysis a = as_analyze_waveform(s.data(), s.size(), sampleRate);
    float packed[9] = {
        a.peak_amplitude, a.negative_peak_amplitude, a.rms_amplitude,
        a.dc_offset, a.crest_factor, a.zero_crossing_rate,
        a.dominant_frequency, a.thd, a.snr};
    jfloatArray out = env->NewFloatArray(9);
    if (out != nullptr) {
        env->SetFloatArrayRegion(out, 0, 9, packed);
    }
    return out;
}

// Returns [freqs..., magsDb..., phases..., peakFreq, peakMag, sampleRate,
// windowSize, hasPhases] — the JS side knows N = (len - 5)/2 to split the
// arrays. Kept flat to avoid a second JNI call.
JNIEXPORT jfloatArray JNICALL
Java_com_audioscope_dsp_DspModule_nativeComputeSpectrum(
    JNIEnv* env, jclass /*klass*/, jlong h, jfloatArray samples,
    jfloat sampleRate, jint window) {
    auto s = from_jfloats(env, samples);
    as_spectrum sp = as_fft_compute_spectrum(
        handle(h), s.data(), s.size(), sampleRate,
        static_cast<as_window_type>(window));

    // Layout: [freqs(n) | mags(n) | phases(n_or_0) | peakFreq, peakMag,
    //          sampleRate, windowSize, hasPhases]
    size_t n = sp.frequencies.len;
    size_t np = sp.phases.len;
    size_t total = n + n + np + 5;
    std::vector<float> buf(total);
    if (n > 0) {
        std::memcpy(buf.data(), sp.frequencies.data, n * sizeof(float));
        std::memcpy(buf.data() + n, sp.magnitudes_db.data, n * sizeof(float));
    }
    if (np > 0) {
        std::memcpy(buf.data() + 2 * n, sp.phases.data, np * sizeof(float));
    }
    float tail[5] = {sp.peak_frequency, sp.peak_magnitude_db,
                     sp.sample_rate, static_cast<float>(sp.window_size),
                     static_cast<float>(sp.has_phases)};
    std::memcpy(buf.data() + 2 * n + np, tail, 5 * sizeof(float));
    as_spectrum_free(&sp);

    jfloatArray out = env->NewFloatArray(static_cast<jsize>(total));
    if (out != nullptr) {
        env->SetFloatArrayRegion(out, 0, static_cast<jsize>(total), buf.data());
    }
    return out;
}

// ---- Oboe capture (AudioBinding interface) ----
// The binding handle is separate from the FFT handle: capture is a long-lived
// stream while FFT processors may come and go. All four methods delegate to
// the audioscope::bindings::AudioBinding virtuals implemented in
// oboe_capture.cpp.

JNIEXPORT jlong JNICALL
Java_com_audioscope_dsp_DspModule_nativeBindingCreate(JNIEnv* /*env*/, jclass /*klass*/) {
    return static_cast<jlong>(reinterpret_cast<uintptr_t>(
        audioscope_android_binding_create()));
}

JNIEXPORT void JNICALL
Java_com_audioscope_dsp_DspModule_nativeBindingDestroy(
    JNIEnv* /*env*/, jclass /*klass*/, jlong h) {
    audioscope_android_binding_destroy(
        reinterpret_cast<audioscope::bindings::AudioBinding*>(static_cast<uintptr_t>(h)));
}

JNIEXPORT jboolean JNICALL
Java_com_audioscope_dsp_DspModule_nativeStartCapture(
    JNIEnv* env, jclass /*klass*/, jlong h, jstring deviceId, jint sampleRate) {
    auto* b = reinterpret_cast<audioscope::bindings::AudioBinding*>(
        static_cast<uintptr_t>(h));
    const char* id = nullptr;
    if (deviceId != nullptr) {
        id = env->GetStringUTFChars(deviceId, nullptr);
    }
    bool ok = b->start_capture(id ? id : "default", static_cast<int>(sampleRate));
    if (deviceId != nullptr && id != nullptr) {
        env->ReleaseStringUTFChars(deviceId, id);
    }
    return ok ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL
Java_com_audioscope_dsp_DspModule_nativeStopCapture(
    JNIEnv* /*env*/, jclass /*klass*/, jlong h) {
    auto* b = reinterpret_cast<audioscope::bindings::AudioBinding*>(
        static_cast<uintptr_t>(h));
    b->stop_capture();
}

JNIEXPORT jfloatArray JNICALL
Java_com_audioscope_dsp_DspModule_nativeReadSamples(
    JNIEnv* env, jclass /*klass*/, jlong h, jint maxCount) {
    auto* b = reinterpret_cast<audioscope::bindings::AudioBinding*>(
        static_cast<uintptr_t>(h));
    std::size_t n = static_cast<std::size_t>(maxCount > 0 ? maxCount : 1024);
    std::vector<float> buf(n);
    std::size_t got = b->read_samples(buf.data(), n);
    jfloatArray out = env->NewFloatArray(static_cast<jsize>(got));
    if (out != nullptr && got > 0) {
        env->SetFloatArrayRegion(out, 0, static_cast<jsize>(got), buf.data());
    }
    return out;
}

JNIEXPORT jboolean JNICALL
Java_com_audioscope_dsp_DspModule_nativeIsCapturing(
    JNIEnv* /*env*/, jclass /*klass*/, jlong h) {
    auto* b = reinterpret_cast<audioscope::bindings::AudioBinding*>(
        static_cast<uintptr_t>(h));
    return b->is_capturing() ? JNI_TRUE : JNI_FALSE;
}

// ==================================================================== //
// Extended DSP surface — parity with the WASM host (sdk/wasm) and the
// Rust FFI host. Every function below has an em_* twin in
// emscripten_main.cpp; the TS wrapper (app/lib/native-dsp-bridge.ts)
// deserializes the packed layouts identically to the WASM wrapper
// (packages/dsp-wasm/src/audioscope-dsp.ts).
// ==================================================================== //

// find_peak_frequency — returns [freq, mag] or [-1, 0] when no peak found.
JNIEXPORT jfloatArray JNICALL
Java_com_audioscope_dsp_DspModule_nativeFindPeakFrequency(
    JNIEnv* env, jclass /*klass*/, jlong h, jfloatArray samples,
    jfloat sampleRate, jfloat minFreq, jfloat maxFreq) {
    auto s = from_jfloats(env, samples);
    float freq = -1.0f, mag = 0.0f;
    int ok = as_fft_find_peak_frequency(handle(h), s.data(), s.size(), sampleRate,
                                        minFreq, maxFreq, &freq, &mag);
    if (ok != 1) freq = -1.0f;
    float packed[2] = {freq, mag};
    jfloatArray out = env->NewFloatArray(2);
    if (out != nullptr) env->SetFloatArrayRegion(out, 0, 2, packed);
    return out;
}

// ---- Scalar time-domain measurements (direct) ----

JNIEXPORT jfloat JNICALL
Java_com_audioscope_dsp_DspModule_nativeFindPeakAmplitude(
    JNIEnv* env, jclass /*klass*/, jfloatArray samples) {
    auto s = from_jfloats(env, samples);
    return as_find_peak_amplitude(s.data(), s.size());
}

JNIEXPORT jfloat JNICALL
Java_com_audioscope_dsp_DspModule_nativeFindNegativePeakAmplitude(
    JNIEnv* env, jclass /*klass*/, jfloatArray samples) {
    auto s = from_jfloats(env, samples);
    return as_find_negative_peak_amplitude(s.data(), s.size());
}

JNIEXPORT jfloat JNICALL
Java_com_audioscope_dsp_DspModule_nativeComputeRms(
    JNIEnv* env, jclass /*klass*/, jfloatArray samples) {
    auto s = from_jfloats(env, samples);
    return as_compute_rms(s.data(), s.size());
}

JNIEXPORT jfloat JNICALL
Java_com_audioscope_dsp_DspModule_nativeComputeDcOffset(
    JNIEnv* env, jclass /*klass*/, jfloatArray samples) {
    auto s = from_jfloats(env, samples);
    return as_compute_dc_offset(s.data(), s.size());
}

JNIEXPORT jfloat JNICALL
Java_com_audioscope_dsp_DspModule_nativeZeroCrossingRate(
    JNIEnv* env, jclass /*klass*/, jfloatArray samples) {
    auto s = from_jfloats(env, samples);
    return as_zero_crossing_rate(s.data(), s.size());
}

JNIEXPORT jfloat JNICALL
Java_com_audioscope_dsp_DspModule_nativeEstimateDominantFrequency(
    JNIEnv* env, jclass /*klass*/, jfloatArray samples, jfloat sampleRate) {
    auto s = from_jfloats(env, samples);
    return as_estimate_dominant_frequency(s.data(), s.size(), sampleRate);
}

// ---- dB conversions (scalar in / scalar out) ----

JNIEXPORT jfloat JNICALL
Java_com_audioscope_dsp_DspModule_nativeAmplitudeToDb(JNIEnv* /*env*/, jclass /*k*/, jfloat a) {
    return as_amplitude_to_db(a);
}
JNIEXPORT jfloat JNICALL
Java_com_audioscope_dsp_DspModule_nativeDbToAmplitude(JNIEnv* /*env*/, jclass /*k*/, jfloat db) {
    return as_db_to_amplitude(db);
}
JNIEXPORT jfloat JNICALL
Java_com_audioscope_dsp_DspModule_nativePeakToDbfs(JNIEnv* /*env*/, jclass /*k*/, jfloat p) {
    return as_peak_to_dbfs(p);
}
JNIEXPORT jfloat JNICALL
Java_com_audioscope_dsp_DspModule_nativeRmsToDbfs(JNIEnv* /*env*/, jclass /*k*/, jfloat r) {
    return as_rms_to_dbfs(r);
}
JNIEXPORT jfloat JNICALL
Java_com_audioscope_dsp_DspModule_nativeDbfsToAmplitude(JNIEnv* /*env*/, jclass /*k*/, jfloat dbfs) {
    return as_dbfs_to_amplitude(dbfs);
}
JNIEXPORT jfloat JNICALL
Java_com_audioscope_dsp_DspModule_nativeCrestFactorDb(JNIEnv* /*env*/, jclass /*k*/, jfloat cf) {
    return as_crest_factor_db(cf);
}
JNIEXPORT jfloat JNICALL
Java_com_audioscope_dsp_DspModule_nativeSnrToDb(JNIEnv* /*env*/, jclass /*k*/, jfloat s, jfloat n) {
    return as_snr_to_db(s, n);
}

// ---- Harmonic analysis ----
// Returns a flat jfloatArray laid out as:
//   [fundFreq, fundMag, fundHarmonic, fundPhase,
//    thd, thdn, signalEnergy, noiseEnergy,
//    N,
//    <N * 4 floats: freq, mag, harmonic, phase per component>]
// The TS wrapper splits this the same way the WASM wrapper reads the struct.
JNIEXPORT jfloatArray JNICALL
Java_com_audioscope_dsp_DspModule_nativeAnalyzeHarmonics(
    JNIEnv* env, jclass /*klass*/, jfloatArray samples, jfloat sampleRate) {
    auto s = from_jfloats(env, samples);
    as_harmonic_analysis ha = as_analyze_harmonics(s.data(), s.size(), sampleRate);

    // harmonics_flat.len is in f32 units; each component is 4 floats.
    const size_t nComponents = ha.harmonics_flat.len / 4;
    const size_t total = 8 + 1 + nComponents * 4;  // header(8) + N(1) + components
    std::vector<float> buf(total);
    buf[0] = ha.fundamental.frequency;
    buf[1] = ha.fundamental.magnitude;
    buf[2] = static_cast<float>(ha.fundamental.harmonic);
    buf[3] = ha.fundamental.phase;
    buf[4] = ha.thd;
    buf[5] = ha.thdn;
    buf[6] = ha.signal_energy;
    buf[7] = ha.noise_energy;
    buf[8] = static_cast<float>(nComponents);
    if (nComponents > 0) {
        std::memcpy(buf.data() + 9, ha.harmonics_flat.data, nComponents * 4 * sizeof(float));
    }
    as_harmonic_analysis_free(&ha);

    jfloatArray out = env->NewFloatArray(static_cast<jsize>(total));
    if (out != nullptr) {
        env->SetFloatArrayRegion(out, 0, static_cast<jsize>(total), buf.data());
    }
    return out;
}

// ---- Spectrogram (STFT) ----
// Returns a flat jfloatArray laid out as:
//   [numFreqs, numTimeBins, sampleRate, windowSize, overlap,
//    <numFreqs floats: frequencies>,
//    <numTimeBins floats: time bins (ms, low-32 bits as float)>,
//    <numRows: each row is [rowLen, <rowLen floats: magnitudes>] flattened>]
// The TS wrapper reconstructs the row-of-arrays from this.
JNIEXPORT jfloatArray JNICALL
Java_com_audioscope_dsp_DspModule_nativeComputeSpectrogram(
    JNIEnv* env, jclass /*klass*/, jfloatArray samples, jfloat sampleRate,
    jint windowSize, jint overlap, jfloat minFreq, jfloat maxFreq, jlong startTimeMs) {
    auto s = from_jfloats(env, samples);
    as_spectrogram_config cfg;
    cfg.window_size = windowSize;
    cfg.overlap = overlap;
    cfg.min_freq = minFreq;
    cfg.max_freq = maxFreq;
    as_spectrogram_data d = as_spectrogram_compute(
        s.data(), s.size(), sampleRate, cfg, static_cast<int64_t>(startTimeMs));

    const size_t numFreqs = d.frequencies.len;
    const size_t numTimeBins = d.time_bins.len;
    const size_t numRows = d.num_rows;

    // First compute the total length so we can allocate once.
    size_t total = 5 + numFreqs + numTimeBins;
    std::vector<size_t> rowLens(numRows);
    for (size_t i = 0; i < numRows; ++i) {
        rowLens[i] = d.magnitude_rows[i].len;
        total += 1 + rowLens[i];  // rowLen prefix + the row data
    }
    std::vector<float> buf(total);
    buf[0] = static_cast<float>(numFreqs);
    buf[1] = static_cast<float>(numTimeBins);
    buf[2] = d.sample_rate;
    buf[3] = static_cast<float>(d.window_size);
    buf[4] = static_cast<float>(d.overlap);

    size_t off = 5;
    if (numFreqs > 0) {
        std::memcpy(buf.data() + off, d.frequencies.data, numFreqs * sizeof(float));
        off += numFreqs;
    }
    for (size_t i = 0; i < numTimeBins; ++i) {
        // ms timestamps fit in 32 bits for realistic durations; store low-32 as float.
        buf[off + i] = static_cast<float>(static_cast<int32_t>(d.time_bins.data[i]));
    }
    off += numTimeBins;
    for (size_t i = 0; i < numRows; ++i) {
        buf[off] = static_cast<float>(rowLens[i]);
        off += 1;
        if (rowLens[i] > 0) {
            std::memcpy(buf.data() + off, d.magnitude_rows[i].data, rowLens[i] * sizeof(float));
            off += rowLens[i];
        }
    }
    as_spectrogram_free(&d);

    jfloatArray out = env->NewFloatArray(static_cast<jsize>(total));
    if (out != nullptr) {
        env->SetFloatArrayRegion(out, 0, static_cast<jsize>(total), buf.data());
    }
    return out;
}

// ---- Compression (LZ4) ----
// compress: returns [sampleCount, originalSize, compressedSize, N, <N bytes as
// floats in 0..255 range>]. The TS wrapper converts the floats back to a
// Uint8Array. Kept flat to avoid a second JNI call + a byte-array type.
JNIEXPORT jfloatArray JNICALL
Java_com_audioscope_dsp_DspModule_nativeCompressWaveform(
    JNIEnv* env, jclass /*klass*/, jfloatArray samples) {
    auto s = from_jfloats(env, samples);
    as_compressed_waveform c = as_compress_waveform(s.data(), s.size());

    const size_t n = c.data.len;
    const size_t total = 4 + n;
    std::vector<float> buf(total);
    buf[0] = static_cast<float>(c.sample_count);
    buf[1] = static_cast<float>(c.original_size);
    buf[2] = static_cast<float>(c.compressed_size);
    buf[3] = static_cast<float>(n);
    for (size_t i = 0; i < n; ++i) {
        buf[4 + i] = static_cast<float>(c.data.data[i]);
    }
    as_compressed_waveform_free(&c);

    jfloatArray out = env->NewFloatArray(static_cast<jsize>(total));
    if (out != nullptr) {
        env->SetFloatArrayRegion(out, 0, static_cast<jsize>(total), buf.data());
    }
    return out;
}

// decompress: takes a float-encoded byte array (0..255) + sampleCount, returns
// the decoded samples or an empty array on decode error.
JNIEXPORT jfloatArray JNICALL
Java_com_audioscope_dsp_DspModule_nativeDecompressWaveform(
    JNIEnv* env, jclass /*klass*/, jfloatArray dataArr, jint sampleCount) {
    auto d = from_jfloats(env, dataArr);
    if (d.empty() || sampleCount <= 0) {
        jfloatArray empty = env->NewFloatArray(0);
        return empty ? empty : env->NewFloatArray(1);
    }
    std::vector<uint8_t> bytes(d.size());
    for (size_t i = 0; i < d.size(); ++i) {
        bytes[i] = static_cast<uint8_t>(static_cast<int32_t>(d[i]) & 0xFF);
    }
    asf32_array out{};
    int ok = as_decompress_waveform(bytes.data(), bytes.size(),
                                    static_cast<size_t>(sampleCount), &out);
    if (ok != 1) {
        asf32_array_free(out);
        return env->NewFloatArray(0);
    }
    jfloatArray result = env->NewFloatArray(static_cast<jsize>(out.len));
    if (result != nullptr && out.len > 0) {
        env->SetFloatArrayRegion(result, 0, static_cast<jsize>(out.len), out.data);
    }
    asf32_array_free(out);
    return result;
}

// ---- Trigger detection ----
// find_trigger: returns [index, armed]. index is -1 when no trigger found.
JNIEXPORT jfloatArray JNICALL
Java_com_audioscope_dsp_DspModule_nativeFindTrigger(
    JNIEnv* env, jclass /*klass*/, jfloatArray data, jint edge,
    jfloat level, jfloat hysteresis, jlong holdoff) {
    auto d = from_jfloats(env, data);
    as_trigger_options opts;
    opts.edge = static_cast<as_trigger_edge>(edge);
    opts.level = level;
    opts.hysteresis = hysteresis;
    opts.holdoff = static_cast<int64_t>(holdoff);
    as_trigger_result r = as_find_trigger(d.data(), d.size(), opts);
    float packed[2] = {static_cast<float>(r.index), static_cast<float>(r.armed)};
    jfloatArray out = env->NewFloatArray(2);
    if (out != nullptr) env->SetFloatArrayRegion(out, 0, 2, packed);
    return out;
}

// triggered_window: returns the aligned window (may be empty when no trigger).
JNIEXPORT jfloatArray JNICALL
Java_com_audioscope_dsp_DspModule_nativeTriggeredWindow(
    JNIEnv* env, jclass /*klass*/, jfloatArray data, jint windowSize,
    jint edge, jfloat level, jfloat hysteresis, jlong holdoff) {
    auto d = from_jfloats(env, data);
    as_trigger_options opts;
    opts.edge = static_cast<as_trigger_edge>(edge);
    opts.level = level;
    opts.hysteresis = hysteresis;
    opts.holdoff = static_cast<int64_t>(holdoff);
    asf32_array w = as_triggered_window(d.data(), d.size(),
                                        static_cast<size_t>(windowSize), opts);
    jfloatArray out = env->NewFloatArray(static_cast<jsize>(w.len));
    if (out != nullptr && w.len > 0) {
        env->SetFloatArrayRegion(out, 0, static_cast<jsize>(w.len), w.data);
    }
    asf32_array_free(w);
    return out;
}

// ---- Resample (nearest-neighbor to exactly `points` samples) ----
JNIEXPORT jfloatArray JNICALL
Java_com_audioscope_dsp_DspModule_nativeResampleTo(
    JNIEnv* env, jclass /*klass*/, jfloatArray data, jint points) {
    auto d = from_jfloats(env, data);
    asf32_array r = as_resample_to(d.data(), d.size(), points);
    jfloatArray out = env->NewFloatArray(static_cast<jsize>(r.len));
    if (out != nullptr && r.len > 0) {
        env->SetFloatArrayRegion(out, 0, static_cast<jsize>(r.len), r.data);
    }
    asf32_array_free(r);
    return out;
}

// ---- Waveform generators ----
JNIEXPORT jfloatArray JNICALL
Java_com_audioscope_dsp_DspModule_nativeGenerateWaveform(
    JNIEnv* env, jclass /*klass*/, jint kind, jdouble frequency,
    jfloat amplitude, jint noise, jdouble sampleRate, jint numSamples) {
    asf32_array g = as_generate_waveform(
        static_cast<as_generator_kind>(kind), frequency, amplitude,
        static_cast<as_noise_type>(noise), sampleRate, static_cast<size_t>(numSamples));
    jfloatArray out = env->NewFloatArray(static_cast<jsize>(g.len));
    if (out != nullptr && g.len > 0) {
        env->SetFloatArrayRegion(out, 0, static_cast<jsize>(g.len), g.data);
    }
    asf32_array_free(g);
    return out;
}

// ---- Version ----
JNIEXPORT jstring JNICALL
Java_com_audioscope_dsp_DspModule_nativeDspVersion(JNIEnv* env, jclass /*klass*/) {
    return env->NewStringUTF(as_dsp_version());
}

// ---- Input device enumeration ----
// Enumerates the OS's connected audio input devices (builtin mic, wired
// headset, USB mics, Bluetooth) by name, entirely in C++ (AudioManager is
// driven via JNI from C++; USB info from /proc/asound). The Kotlin side only
// passes the ReactApplicationContext through; no Java enumeration logic. The
// returned JSON array is parsed by the TS bridge
// (app/lib/native-dsp-bridge.ts → Dsp.enumerateInputDevices()).
JNIEXPORT jstring JNICALL
Java_com_audioscope_dsp_DspModule_nativeEnumerateInputDevices(
    JNIEnv* env, jclass /*klass*/, jobject context) {
    std::string json = audioscope::bindings::enumerate_input_devices(env, context);
    return env->NewStringUTF(json.c_str());
}

}  // extern "C"
