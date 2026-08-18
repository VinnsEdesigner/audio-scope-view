// native-dsp-bridge.ts — JS-side wrapper over the native DspModule (Kotlin),
// which calls the C++ DSP core through JNI (libaudioscope_dsp.so).
//
// This is the mobile analog of the web's @audio-scope-view/dsp-wasm wrapper
// (AudioScopeDsp, backed by the WASM build in sdk/wasm) and the Rust server's
// dsp_ffi.rs host. All three bind to the SAME flat C ABI in
// sdk/bindings/ffi/audioscope_ffi.h; JS only sees measurements + spectra.
//
// The typed surface below mirrors AudioScopeDsp (packages/dsp-wasm/src/
// audioscope-dsp.ts) one-for-one: same method names, same option shapes, same
// return types. The only difference is the backing — NativeModules.AudioScopeDsp
// + packed jfloatArray layouts (jni_bridge.cpp) instead of the WASM heap. This
// lets the RN hooks port the web hooks verbatim, swapping the dsp source only.
//
// On Android, NativeModules.AudioScopeDsp is registered by DspPackage.kt.
// On non-Android (web/iOS dev without the module), calls throw a clear error
// so the UI can fall back to a placeholder state.

import { NativeModules, Platform } from "react-native";

export type DspHandle = number;
export type CaptureHandle = number;

// ---- Types mirroring packages/dsp-wasm/src/types.ts ----

export type WindowType = "rectangular" | "hann" | "hamming" | "blackman";
export type TriggerEdge = "rising" | "falling" | "auto";
export type GeneratorKind = "sine" | "square" | "sawtooth" | "triangle" | "noise";
export type NoiseType = "white" | "pink" | "brown";

export interface TriggerOptions {
  edge: TriggerEdge;
  level: number;
  hysteresis?: number;
  /** Ignore this many samples at the start (holdoff). */
  holdoff?: number;
}

export interface TriggerResult {
  /** Trigger sample index, or -1 when no crossing is found. */
  index: number;
  armed: boolean;
}

export interface Spectrum {
  frequencies: number[];
  magnitudesDb: number[];
  phases: number[];
  peakFrequency: number;
  peakMagnitudeDb: number;
  sampleRate: number;
  windowSize: number;
  hasPhases: boolean;
}

export interface WaveformMeasurements {
  peakAmplitude: number;
  negativePeakAmplitude: number;
  rmsAmplitude: number;
  dcOffset: number;
  crestFactor: number;
  zeroCrossingRate: number;
  dominantFrequency: number;
  /** Total harmonic distortion, 0..1 (fraction, not percent). */
  thd: number;
  /** Signal-to-noise ratio, in dB. */
  snr: number;
}

export interface FrequencyComponent {
  frequency: number;
  magnitude: number;
  /** 1 = fundamental, 2 = 2nd harmonic, … */
  harmonic: number;
  phase: number;
}

export interface HarmonicAnalysis {
  fundamental: FrequencyComponent;
  harmonics: FrequencyComponent[];
  /** 0..1 (fraction). */
  thd: number;
  /** 0..1 (fraction). */
  thdn: number;
  signalEnergy: number;
  noiseEnergy: number;
}

export interface SpectrogramConfig {
  windowSize: number;
  overlap: number;
  minFreq: number;
  maxFreq: number;
}

export interface SpectrogramData {
  /** Per frequency bin, in Hz. */
  frequencies: number[];
  /** Per time slice, in ms. */
  timeBins: Int32Array;
  /**
   * Magnitude rows (dB), one number[] per time slice. Row length equals
   * frequencies.length.
   */
  magnitudes: number[][];
  sampleRate: number;
  windowSize: number;
  overlap: number;
}

export interface CompressedWaveform {
  data: Uint8Array;
  sampleCount: number;
  originalSize: number;
  compressedSize: number;
}

/**
 * A connected audio input device visible to the Android audio framework
 * (returned by `Dsp.enumerateInputDevices()`). The `id` is the
 * AudioDeviceInfo/Oboe device id — pass it as `deviceId` to `startCapture()`
 * to route capture to that device.
 */
export type AudioInputDeviceKind =
  | "builtin-mic"
  | "wired-headset"
  | "wired-headphones"
  | "usb-device"
  | "usb-headset"
  | "bluetooth-sco"
  | "bluetooth-a2dp"
  | "dock"
  | "hdmi"
  | "telephony"
  | "fm"
  | "unknown";

export interface AudioInputDevice {
  /** Oboe/AudioDeviceInfo id (as a string) — pass to startCapture(). */
  id: string;
  /** Human-readable name (e.g. "Built-in microphone", "USB Audio Device"). */
  name: string;
  /** Normalized device kind. */
  type: AudioInputDeviceKind;
  /** Product name (falls back to `name` when the framework returns null). */
  productName: string;
  /** True for the framework's first/default reported input. */
  isDefault: boolean;
  /** Supported sample rates (Hz). */
  sampleRates: number[];
  /** Supported channel counts. */
  channels: number[];
  /** USB vendor id (16-bit) when /proc/asound exposes it, else absent. */
  usbVendor?: number;
  /** USB product id (16-bit) when /proc/asound exposes it, else absent. */
  usbProduct?: number;
  /** ALSA card number for the matching /proc/asound entry, else absent. */
  alsaCard?: number;
}

// ---- Enum maps (mirror the WASM wrapper's KIND_TO_C / NOISE_TO_C / EDGE_TO_C) ----

const WINDOW_TO_C: Record<WindowType, 0 | 1 | 2 | 3> = {
  rectangular: 0,
  hann: 1,
  hamming: 2,
  blackman: 3,
};

const EDGE_TO_C: Record<TriggerEdge, 0 | 1 | 2> = {
  rising: 0,
  falling: 1,
  auto: 2,
};

const KIND_TO_C: Record<GeneratorKind, 0 | 1 | 2 | 3 | 4> = {
  sine: 0,
  square: 1,
  sawtooth: 2,
  triangle: 3,
  noise: 4,
};

const NOISE_TO_C: Record<NoiseType, 0 | 1 | 2> = {
  white: 0,
  pink: 1,
  brown: 2,
};

const Native = NativeModules.AudioScopeDsp;

function requireNative(): NonNullable<typeof Native> {
  if (!Native) {
    throw new Error(
      "AudioScopeDsp native module not available. " +
        (Platform.OS === "android"
          ? "libaudioscope_dsp.so failed to load — check the CMake build."
          : "DspModule is Android-only on this device."),
    );
  }
  return Native;
}

/** Coerce a Float32Array | number[] input into the number[] JNI expects. */
function toNumArray(samples: Float32Array | number[]): number[] {
  return Array.isArray(samples) ? samples : Array.from(samples);
}

export const Dsp = {
  // ---- FFT processor handle (AudioscopeFft*) ----

  /** Create an FFT processor handle (as_fft_new). */
  create(): Promise<DspHandle> {
    return requireNative().create();
  },

  /** Free an FFT processor handle (as_fft_free). */
  destroy(handle: DspHandle): Promise<void> {
    return requireNative().destroy(handle);
  },

  /** Hann-windowed FFT magnitudes in dB (half spectrum). */
  computeMagnitudes(
    handle: DspHandle,
    samples: Float32Array | number[],
    sampleRate: number,
  ): Promise<number[]> {
    return requireNative().computeMagnitudes(handle, toNumArray(samples), sampleRate);
  },

  /** Find the peak frequency within [minFreq, maxFreq]. Returns -1 when none. */
  findPeakFrequency(
    handle: DspHandle,
    samples: Float32Array | number[],
    sampleRate: number,
    minFreq = 0,
    maxFreq = sampleRate / 2,
  ): Promise<{ frequency: number; magnitude: number }> {
    return requireNative()
      .findPeakFrequency(handle, toNumArray(samples), sampleRate, minFreq, maxFreq)
      .then((packed: number[]) => ({ frequency: packed[0], magnitude: packed[1] }));
  },

  /** Full spectrum: frequencies + dB magnitudes + phases + peak. */
  computeSpectrum(
    handle: DspHandle,
    samples: Float32Array | number[],
    sampleRate: number,
    window: WindowType = "hann",
  ): Promise<Spectrum> {
    return requireNative()
      .computeSpectrum(handle, toNumArray(samples), sampleRate, WINDOW_TO_C[window])
      .then((buf: number[]) => {
        // Layout from jni_bridge.cpp: [freqs(n) | mags(n) | phases(np) |
        // peakFreq, peakMag, sampleRate, windowSize, hasPhases]
        const tail = buf.slice(-5);
        const bodyLen = buf.length - 5;
        const hasPhases = tail[4] !== 0;
        const np = hasPhases ? Math.floor(bodyLen / 3) : 0;
        const n = Math.floor((bodyLen - np) / 2);
        const freqs = buf.slice(0, n);
        const mags = buf.slice(n, 2 * n);
        const phases = np > 0 ? buf.slice(2 * n, 2 * n + np) : [];
        return {
          frequencies: freqs,
          magnitudesDb: mags,
          phases,
          peakFrequency: tail[0],
          peakMagnitudeDb: tail[1],
          sampleRate: tail[2],
          windowSize: tail[3],
          hasPhases,
        };
      });
  },

  // ---- Time-domain measurements (packed + scalar) ----

  /** Time-domain measurements (peak/rms/dc/thd/snr/…). */
  measurements(
    handle: DspHandle,
    samples: Float32Array | number[],
    sampleRate: number,
  ): Promise<WaveformMeasurements> {
    return requireNative()
      .measurements(handle, toNumArray(samples), sampleRate)
      .then((packed: number[]) => ({
        peakAmplitude: packed[0],
        negativePeakAmplitude: packed[1],
        rmsAmplitude: packed[2],
        dcOffset: packed[3],
        crestFactor: packed[4],
        zeroCrossingRate: packed[5],
        dominantFrequency: packed[6],
        thd: packed[7],
        snr: packed[8],
      }));
  },

  findPeakAmplitude(samples: Float32Array | number[]): Promise<number> {
    return requireNative().findPeakAmplitude(toNumArray(samples));
  },

  findNegativePeakAmplitude(samples: Float32Array | number[]): Promise<number> {
    return requireNative().findNegativePeakAmplitude(toNumArray(samples));
  },

  computeRms(samples: Float32Array | number[]): Promise<number> {
    return requireNative().computeRms(toNumArray(samples));
  },

  computeDcOffset(samples: Float32Array | number[]): Promise<number> {
    return requireNative().computeDcOffset(toNumArray(samples));
  },

  zeroCrossingRate(samples: Float32Array | number[]): Promise<number> {
    return requireNative().zeroCrossingRate(toNumArray(samples));
  },

  estimateDominantFrequency(
    samples: Float32Array | number[],
    sampleRate: number,
  ): Promise<number> {
    return requireNative().estimateDominantFrequency(toNumArray(samples), sampleRate);
  },

  // ---- dB conversions (scalar in / scalar out) ----

  amplitudeToDb(a: number): Promise<number> {
    return requireNative().amplitudeToDb(a);
  },
  dbToAmplitude(db: number): Promise<number> {
    return requireNative().dbToAmplitude(db);
  },
  peakToDbfs(p: number): Promise<number> {
    return requireNative().peakToDbfs(p);
  },
  rmsToDbfs(r: number): Promise<number> {
    return requireNative().rmsToDbfs(r);
  },
  dbfsToAmplitude(dbfs: number): Promise<number> {
    return requireNative().dbfsToAmplitude(dbfs);
  },
  crestFactorDb(cf: number): Promise<number> {
    return requireNative().crestFactorDb(cf);
  },
  snrToDb(signal: number, noise: number): Promise<number> {
    return requireNative().snrToDb(signal, noise);
  },

  // ---- Harmonic analysis ----

  analyzeHarmonics(
    samples: Float32Array | number[],
    sampleRate: number,
  ): Promise<HarmonicAnalysis> {
    return requireNative()
      .analyzeHarmonics(toNumArray(samples), sampleRate)
      .then((buf: number[]) => {
        // Layout: [fundFreq, fundMag, fundHarmonic, fundPhase,
        //          thd, thdn, signalEnergy, noiseEnergy, N,
        //          <N*4 floats: freq, mag, harmonic, phase per component>]
        const n = Math.floor(buf[8]);
        const harmonics: FrequencyComponent[] = [];
        for (let i = 0; i < n; i++) {
          const off = 9 + i * 4;
          harmonics.push({
            frequency: buf[off],
            magnitude: buf[off + 1],
            harmonic: Math.floor(buf[off + 2]),
            phase: buf[off + 3],
          });
        }
        return {
          fundamental: {
            frequency: buf[0],
            magnitude: buf[1],
            harmonic: Math.floor(buf[2]),
            phase: buf[3],
          },
          harmonics,
          thd: buf[4],
          thdn: buf[5],
          signalEnergy: buf[6],
          noiseEnergy: buf[7],
        };
      });
  },

  // ---- Spectrogram (STFT) ----

  computeSpectrogram(
    samples: Float32Array | number[],
    sampleRate: number,
    config: SpectrogramConfig,
    startTimeMs = 0,
  ): Promise<SpectrogramData> {
    return requireNative()
      .computeSpectrogram(
        toNumArray(samples),
        sampleRate,
        config.windowSize,
        config.overlap,
        config.minFreq,
        config.maxFreq,
        startTimeMs,
      )
      .then((buf: number[]) => {
        // Layout: [numFreqs, numTimeBins, sampleRate, windowSize, overlap,
        //          <numFreqs: frequencies>,
        //          <numTimeBins: time bins (ms as float)>,
        //          <numRows: [rowLen, <rowLen floats>] …>]
        const numFreqs = Math.floor(buf[0]);
        const numTimeBins = Math.floor(buf[1]);
        const sampleRateOut = buf[2];
        const windowSize = Math.floor(buf[3]);
        const overlap = Math.floor(buf[4]);
        let off = 5;
        const frequencies = numFreqs > 0 ? buf.slice(off, off + numFreqs) : [];
        off += numFreqs;
        const timeBins = new Int32Array(numTimeBins);
        for (let i = 0; i < numTimeBins; i++) {
          timeBins[i] = Math.floor(buf[off + i]);
        }
        off += numTimeBins;
        const magnitudes: number[][] = [];
        // Rows continue until the buffer is exhausted.
        while (off < buf.length) {
          const rowLen = Math.floor(buf[off]);
          off += 1;
          magnitudes.push(rowLen > 0 ? buf.slice(off, off + rowLen) : []);
          off += rowLen;
        }
        return {
          frequencies,
          timeBins,
          magnitudes,
          sampleRate: sampleRateOut,
          windowSize,
          overlap,
        };
      });
  },

  // ---- Compression (LZ4) ----

  compressWaveform(samples: Float32Array | number[]): Promise<CompressedWaveform> {
    return requireNative()
      .compressWaveform(toNumArray(samples))
      .then((buf: number[]) => {
        // Layout: [sampleCount, originalSize, compressedSize, N, <N bytes as floats 0..255>]
        const n = Math.floor(buf[3]);
        const data = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          data[i] = Math.floor(buf[4 + i]) & 0xff;
        }
        return {
          data,
          sampleCount: Math.floor(buf[0]),
          originalSize: Math.floor(buf[1]),
          compressedSize: Math.floor(buf[2]),
        };
      });
  },

  decompressWaveform(data: Uint8Array, sampleCount: number): Promise<Float32Array | null> {
    // Encode the bytes as floats (0..255) for the JNI bridge.
    const floats = new Array<number>(data.length);
    for (let i = 0; i < data.length; i++) floats[i] = data[i];
    return requireNative()
      .decompressWaveform(floats, sampleCount)
      .then((out: number[]) => (out.length > 0 ? new Float32Array(out) : null));
  },

  // ---- Trigger detection ----

  findTrigger(data: Float32Array | number[], options: TriggerOptions): Promise<TriggerResult> {
    return requireNative()
      .findTrigger(
        toNumArray(data),
        EDGE_TO_C[options.edge],
        options.level,
        options.hysteresis ?? 0.02,
        options.holdoff ?? 0,
      )
      .then((packed: number[]) => ({
        index: Math.floor(packed[0]),
        armed: packed[1] !== 0,
      }));
  },

  triggeredWindow(
    data: Float32Array | number[],
    windowSize: number,
    options: TriggerOptions,
  ): Promise<Float32Array | null> {
    return requireNative()
      .triggeredWindow(
        toNumArray(data),
        windowSize,
        EDGE_TO_C[options.edge],
        options.level,
        options.hysteresis ?? 0.02,
        options.holdoff ?? 0,
      )
      .then((out: number[]) => (out.length > 0 ? new Float32Array(out) : null));
  },

  // ---- Resample (nearest-neighbor to exactly `points` samples) ----

  resampleTo(data: Float32Array | number[], points: number): Promise<Float32Array> {
    return requireNative()
      .resampleTo(toNumArray(data), points)
      .then((out: number[]) => new Float32Array(out));
  },

  // ---- Waveform generators ----

  generateWaveform(opts: {
    kind: GeneratorKind;
    frequency?: number;
    amplitude?: number;
    noiseType?: NoiseType;
    sampleRate: number;
    numSamples: number;
  }): Promise<Float32Array> {
    return requireNative()
      .generateWaveform(
        KIND_TO_C[opts.kind],
        opts.frequency ?? 440,
        opts.amplitude ?? 1,
        NOISE_TO_C[opts.noiseType ?? "white"],
        opts.sampleRate,
        opts.numSamples,
      )
      .then((out: number[]) => new Float32Array(out));
  },

  // ---- Version ----

  dspVersion(): Promise<string> {
    return requireNative().dspVersion();
  },

  // ---- Oboe capture (AudioBinding handle) ----

  /** Create an Oboe capture binding handle. */
  createBinding(): Promise<CaptureHandle> {
    return requireNative().createBinding();
  },

  /** Free an Oboe capture binding handle. */
  destroyBinding(handle: CaptureHandle): Promise<void> {
    return requireNative().destroyBinding(handle);
  },

  /** Start low-latency mic capture at `sampleRate` (Oboe AAudio/OpenSL). */
  startCapture(
    handle: CaptureHandle,
    deviceId: string,
    sampleRate: number,
  ): Promise<boolean> {
    return requireNative().startCapture(handle, deviceId, sampleRate);
  },

  /** Stop an active capture. */
  stopCapture(handle: CaptureHandle): Promise<void> {
    return requireNative().stopCapture(handle);
  },

  /** Drain up to `maxCount` captured float32 samples from the ring buffer. */
  readSamples(handle: CaptureHandle, maxCount: number): Promise<number[]> {
    return requireNative().readSamples(handle, maxCount);
  },

  /** True when the Oboe stream is open and running. */
  isCapturing(handle: CaptureHandle): Promise<boolean> {
    return requireNative().isCapturing(handle);
  },

  /**
   * Enumerate the OS's connected audio input devices by name (builtin mic,
   * wired headset, USB mics, Bluetooth). Done entirely in C++
   * (AudioManager driven via JNI + /proc/asound USB parse). The returned
   * `id` is the Oboe device id — pass it to `startCapture()` to route
   * capture to a specific device (e.g. a USB mic).
   */
  enumerateInputDevices(): Promise<AudioInputDevice[]> {
    return requireNative()
      .enumerateInputDevices()
      .then((raw: string) => {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? (parsed as AudioInputDevice[]) : [];
        } catch {
          return [];
        }
      });
  },
};
