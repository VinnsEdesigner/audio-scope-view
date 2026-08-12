package com.audioscope.dsp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import android.content.Context

/**
 * DspModule — JSI-adjacent native module bridging JS to the C++ DSP core
 * (libaudioscope_dsp.so) through JNI.
 *
 * The C++ core (sdk/dsp) is exposed via a flat C ABI (sdk/bindings/ffi/
 * audioscope_ffi.h). This module marshalls JS arrays ↔ C `asf32_array` and
 * hands opaque `long` handles back to JS so the FFT processor is reused
 * across calls. This is the Android analog of the WASM host
 * (sdk/wasm/emscripten_main.cpp) and the Rust server host.
 *
 * Lifecycle:
 *   const h = await DspModule.create();           // as_fft_new
 *   const mags = await DspModule.computeMagnitudes(h, samples, 48000);
 *   const ms   = await DspModule.measurements(h, samples, 48000);
 *   await DspModule.destroy(h);                   // as_fft_free
 */
class DspModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        init {
            // Load the C++ DSP core + JNI bridge + Oboe capture binding.
            System.loadLibrary("audioscope_dsp")
        }
    }

    override fun getName(): String = "AudioScopeDsp"

    // ---- FFT processor handle (AudioscopeFft*) ----
    @ReactMethod
    fun create(promise: Promise) {
        promise.resolve(nativeCreate())
    }

    @ReactMethod
    fun destroy(handle: Double, promise: Promise) {
        nativeDestroy(handle.toLong())
        promise.resolve(null)
    }

    @ReactMethod
    fun computeMagnitudes(handle: Double, samples: ReadableArray, sampleRate: Double, promise: Promise) {
        val floats = toFloatArray(samples)
        val out = nativeComputeMagnitudes(handle.toLong(), floats, sampleRate.toFloat())
        promise.resolve(out)
    }

    @ReactMethod
    fun measurements(handle: Double, samples: ReadableArray, sampleRate: Double, promise: Promise) {
        val floats = toFloatArray(samples)
        val out = nativeMeasurements(handle.toLong(), floats, sampleRate.toFloat())
        promise.resolve(out)
    }

    @ReactMethod
    fun computeSpectrum(handle: Double, samples: ReadableArray, sampleRate: Double, window: Int, promise: Promise) {
        val floats = toFloatArray(samples)
        val out = nativeComputeSpectrum(handle.toLong(), floats, sampleRate.toFloat(), window)
        promise.resolve(out)
    }

    // ---- Oboe capture (AudioBinding handle, separate from FFT handle) ----
    @ReactMethod
    fun createBinding(promise: Promise) {
        promise.resolve(nativeBindingCreate())
    }

    @ReactMethod
    fun destroyBinding(handle: Double, promise: Promise) {
        nativeBindingDestroy(handle.toLong())
        promise.resolve(null)
    }

    @ReactMethod
    fun startCapture(handle: Double, deviceId: String, sampleRate: Int, promise: Promise) {
        val ok = nativeStartCapture(handle.toLong(), deviceId, sampleRate)
        promise.resolve(ok)
    }

    @ReactMethod
    fun stopCapture(handle: Double, promise: Promise) {
        nativeStopCapture(handle.toLong())
        promise.resolve(null)
    }

    @ReactMethod
    fun readSamples(handle: Double, maxCount: Int, promise: Promise) {
        val out = nativeReadSamples(handle.toLong(), maxCount)
        promise.resolve(out)
    }

    @ReactMethod
    fun isCapturing(handle: Double, promise: Promise) {
        promise.resolve(nativeIsCapturing(handle.toLong()))
    }

    // ---- Input device enumeration (C++ AudioManager-via-JNI + /proc/asound) ----
    // Returns a JSON array string of connected input devices by name
    // (builtin-mic / wired-headset / usb-device / usb-headset / bluetooth-* / ...).
    // The enumeration is done entirely in C++ (device_enumeration.cpp); this
    // method only passes the ReactApplicationContext through.
    @ReactMethod
    fun enumerateInputDevices(promise: Promise) {
        promise.resolve(nativeEnumerateInputDevices(reactApplicationContext))
    }

    // ---- Extended DSP surface (parity with the WASM host) ----

    @ReactMethod
    fun findPeakFrequency(handle: Double, samples: ReadableArray, sampleRate: Double, minFreq: Double, maxFreq: Double, promise: Promise) {
        val floats = toFloatArray(samples)
        val out = nativeFindPeakFrequency(handle.toLong(), floats, sampleRate.toFloat(), minFreq.toFloat(), maxFreq.toFloat())
        promise.resolve(out)
    }

    @ReactMethod
    fun findPeakAmplitude(samples: ReadableArray, promise: Promise) {
        val floats = toFloatArray(samples)
        promise.resolve(nativeFindPeakAmplitude(floats))
    }

    @ReactMethod
    fun findNegativePeakAmplitude(samples: ReadableArray, promise: Promise) {
        val floats = toFloatArray(samples)
        promise.resolve(nativeFindNegativePeakAmplitude(floats))
    }

    @ReactMethod
    fun computeRms(samples: ReadableArray, promise: Promise) {
        val floats = toFloatArray(samples)
        promise.resolve(nativeComputeRms(floats))
    }

    @ReactMethod
    fun computeDcOffset(samples: ReadableArray, promise: Promise) {
        val floats = toFloatArray(samples)
        promise.resolve(nativeComputeDcOffset(floats))
    }

    @ReactMethod
    fun zeroCrossingRate(samples: ReadableArray, promise: Promise) {
        val floats = toFloatArray(samples)
        promise.resolve(nativeZeroCrossingRate(floats))
    }

    @ReactMethod
    fun estimateDominantFrequency(samples: ReadableArray, sampleRate: Double, promise: Promise) {
        val floats = toFloatArray(samples)
        promise.resolve(nativeEstimateDominantFrequency(floats, sampleRate.toFloat()))
    }

    @ReactMethod
    fun amplitudeToDb(a: Double, promise: Promise) {
        promise.resolve(nativeAmplitudeToDb(a.toFloat()))
    }

    @ReactMethod
    fun dbToAmplitude(db: Double, promise: Promise) {
        promise.resolve(nativeDbToAmplitude(db.toFloat()))
    }

    @ReactMethod
    fun peakToDbfs(p: Double, promise: Promise) {
        promise.resolve(nativePeakToDbfs(p.toFloat()))
    }

    @ReactMethod
    fun rmsToDbfs(r: Double, promise: Promise) {
        promise.resolve(nativeRmsToDbfs(r.toFloat()))
    }

    @ReactMethod
    fun dbfsToAmplitude(dbfs: Double, promise: Promise) {
        promise.resolve(nativeDbfsToAmplitude(dbfs.toFloat()))
    }

    @ReactMethod
    fun crestFactorDb(cf: Double, promise: Promise) {
        promise.resolve(nativeCrestFactorDb(cf.toFloat()))
    }

    @ReactMethod
    fun snrToDb(signal: Double, noise: Double, promise: Promise) {
        promise.resolve(nativeSnrToDb(signal.toFloat(), noise.toFloat()))
    }

    @ReactMethod
    fun analyzeHarmonics(samples: ReadableArray, sampleRate: Double, promise: Promise) {
        val floats = toFloatArray(samples)
        val out = nativeAnalyzeHarmonics(floats, sampleRate.toFloat())
        promise.resolve(out)
    }

    @ReactMethod
    fun computeSpectrogram(samples: ReadableArray, sampleRate: Double, windowSize: Int, overlap: Int, minFreq: Double, maxFreq: Double, startTimeMs: Double, promise: Promise) {
        val floats = toFloatArray(samples)
        val out = nativeComputeSpectrogram(floats, sampleRate.toFloat(), windowSize, overlap, minFreq.toFloat(), maxFreq.toFloat(), startTimeMs.toLong())
        promise.resolve(out)
    }

    @ReactMethod
    fun compressWaveform(samples: ReadableArray, promise: Promise) {
        val floats = toFloatArray(samples)
        val out = nativeCompressWaveform(floats)
        promise.resolve(out)
    }

    @ReactMethod
    fun decompressWaveform(data: ReadableArray, sampleCount: Int, promise: Promise) {
        val floats = toFloatArray(data)
        val out = nativeDecompressWaveform(floats, sampleCount)
        promise.resolve(out)
    }

    @ReactMethod
    fun findTrigger(data: ReadableArray, edge: Int, level: Double, hysteresis: Double, holdoff: Double, promise: Promise) {
        val floats = toFloatArray(data)
        val out = nativeFindTrigger(floats, edge, level.toFloat(), hysteresis.toFloat(), holdoff.toLong())
        promise.resolve(out)
    }

    @ReactMethod
    fun triggeredWindow(data: ReadableArray, windowSize: Int, edge: Int, level: Double, hysteresis: Double, holdoff: Double, promise: Promise) {
        val floats = toFloatArray(data)
        val out = nativeTriggeredWindow(floats, windowSize, edge, level.toFloat(), hysteresis.toFloat(), holdoff.toLong())
        promise.resolve(out)
    }

    @ReactMethod
    fun resampleTo(data: ReadableArray, points: Int, promise: Promise) {
        val floats = toFloatArray(data)
        val out = nativeResampleTo(floats, points)
        promise.resolve(out)
    }

    @ReactMethod
    fun generateWaveform(kind: Int, frequency: Double, amplitude: Double, noise: Int, sampleRate: Double, numSamples: Int, promise: Promise) {
        val out = nativeGenerateWaveform(kind, frequency, amplitude.toFloat(), noise, sampleRate, numSamples)
        promise.resolve(out)
    }

    @ReactMethod
    fun dspVersion(promise: Promise) {
        promise.resolve(nativeDspVersion())
    }

    private fun toFloatArray(arr: ReadableArray): FloatArray {
        val out = FloatArray(arr.size())
        for (i in 0 until arr.size()) {
            out[i] = arr.getDouble(i).toFloat()
        }
        return out
    }

    // ---- JNI exports (jni_bridge.cpp) ----
    private external fun nativeCreate(): Double
    private external fun nativeDestroy(handle: Long)
    private external fun nativeComputeMagnitudes(handle: Long, samples: FloatArray, sampleRate: Float): FloatArray
    private external fun nativeMeasurements(handle: Long, samples: FloatArray, sampleRate: Float): FloatArray
    private external fun nativeComputeSpectrum(handle: Long, samples: FloatArray, sampleRate: Float, window: Int): FloatArray

    // Oboe capture
    private external fun nativeBindingCreate(): Double
    private external fun nativeBindingDestroy(handle: Long)
    private external fun nativeStartCapture(handle: Long, deviceId: String, sampleRate: Int): Boolean
    private external fun nativeStopCapture(handle: Long)
    private external fun nativeReadSamples(handle: Long, maxCount: Int): FloatArray
    private external fun nativeIsCapturing(handle: Long): Boolean

    // Input device enumeration (device_enumeration.cpp)
    private external fun nativeEnumerateInputDevices(context: Context): String

    // Extended DSP surface
    private external fun nativeFindPeakFrequency(handle: Long, samples: FloatArray, sampleRate: Float, minFreq: Float, maxFreq: Float): FloatArray
    private external fun nativeFindPeakAmplitude(samples: FloatArray): Float
    private external fun nativeFindNegativePeakAmplitude(samples: FloatArray): Float
    private external fun nativeComputeRms(samples: FloatArray): Float
    private external fun nativeComputeDcOffset(samples: FloatArray): Float
    private external fun nativeZeroCrossingRate(samples: FloatArray): Float
    private external fun nativeEstimateDominantFrequency(samples: FloatArray, sampleRate: Float): Float
    private external fun nativeAmplitudeToDb(a: Float): Float
    private external fun nativeDbToAmplitude(db: Float): Float
    private external fun nativePeakToDbfs(p: Float): Float
    private external fun nativeRmsToDbfs(r: Float): Float
    private external fun nativeDbfsToAmplitude(dbfs: Float): Float
    private external fun nativeCrestFactorDb(cf: Float): Float
    private external fun nativeSnrToDb(signal: Float, noise: Float): Float
    private external fun nativeAnalyzeHarmonics(samples: FloatArray, sampleRate: Float): FloatArray
    private external fun nativeComputeSpectrogram(samples: FloatArray, sampleRate: Float, windowSize: Int, overlap: Int, minFreq: Float, maxFreq: Float, startTimeMs: Long): FloatArray
    private external fun nativeCompressWaveform(samples: FloatArray): FloatArray
    private external fun nativeDecompressWaveform(data: FloatArray, sampleCount: Int): FloatArray
    private external fun nativeFindTrigger(data: FloatArray, edge: Int, level: Float, hysteresis: Float, holdoff: Long): FloatArray
    private external fun nativeTriggeredWindow(data: FloatArray, windowSize: Int, edge: Int, level: Float, hysteresis: Float, holdoff: Long): FloatArray
    private external fun nativeResampleTo(data: FloatArray, points: Int): FloatArray
    private external fun nativeGenerateWaveform(kind: Int, frequency: Double, amplitude: Float, noise: Int, sampleRate: Double, numSamples: Int): FloatArray
    private external fun nativeDspVersion(): String
}
