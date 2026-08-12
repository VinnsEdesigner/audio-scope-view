// use-audio-analyzer.ts — RN port of the web hook. The web version uses
// getUserMedia + an AnalyserNode + a rAF tick loop, routing measurements
// through the WASM DSP core. On RN capture runs through Oboe (C++ ring buffer
// → JNI readSamples) and measurements run through the C++ DSP core via the
// native bridge; there is no Web Audio AnalyserNode.
//
// The exposed AudioAnalyzerState + return shape matches the web hook so the
// scope screen and ported hooks (use-export, use-scope-capture) consume it
// unchanged. The capture lifecycle mirrors use-mobile-audio:
//   start()  → createBinding → startCapture → poll loop (readSamples → DSP)
//   stop()   → stopCapture → destroyBinding
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import { Dsp, type CaptureHandle, type DspHandle } from "../lib/native-dsp-bridge";
import { useAudioStore } from "../store";
import { useScopeStore } from "../store";

export type RecordingState = "idle" | "recording" | "paused";

export interface UseAudioAnalyzerOptions {
  deviceId?: string;
  desiredSampleRate?: number;
  fftSize?: number;
  smoothingTimeConstant?: number;
  waveformPoints?: number;
  sampleCollectionInterval?: number;
}

export interface AudioAnalyzerState {
  recordingState: RecordingState;
  volumeLevel: number;
  peakLevel: number;
  waveformData: number[];
  sampleRate: number;
  duration: number;
  samples: Float32Array;
  analysisFrame: Float32Array;
  vpp: number;
  frequency: number;
  windowMs: number;
  error: Error | undefined;
}

export interface UseAudioAnalyzerReturn extends AudioAnalyzerState {
  startCapture: () => Promise<void>;
  pauseCapture: () => void;
  resumeCapture: () => void;
  stopCapture: () => Float32Array;
  discardCapture: () => void;
  isCapturing: boolean;
}

const DEFAULT_FFT_SIZE = 4096;
const DEFAULT_WAVEFORM_POINTS = 256;
const POLL_INTERVAL_MS = 16; // ~60 Hz UI cadence
const READ_BLOCK = 4096; // samples per drain
const ANALYSIS_FRAME_INTERVAL_MS = 100;

const EMPTY_SAMPLES = new Float32Array();

function createInitialState(): AudioAnalyzerState {
  return {
    recordingState: "idle",
    volumeLevel: 0,
    peakLevel: 0,
    waveformData: [],
    sampleRate: useAudioStore.getState().sampleRate,
    duration: 0,
    samples: EMPTY_SAMPLES,
    analysisFrame: EMPTY_SAMPLES,
    vpp: 0,
    frequency: 0,
    windowMs: 0,
    error: undefined,
  };
}

let state: AudioAnalyzerState = createInitialState();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<AudioAnalyzerState>) {
  state = { ...state, ...patch };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

let options: Required<Omit<UseAudioAnalyzerOptions, "deviceId" | "desiredSampleRate">> &
  Pick<UseAudioAnalyzerOptions, "deviceId" | "desiredSampleRate"> = {
  deviceId: undefined,
  desiredSampleRate: undefined,
  fftSize: DEFAULT_FFT_SIZE,
  smoothingTimeConstant: 0.3,
  waveformPoints: DEFAULT_WAVEFORM_POINTS,
  sampleCollectionInterval: POLL_INTERVAL_MS,
};

function mergeOptions(next: UseAudioAnalyzerOptions) {
  const merged: typeof options = { ...options };
  for (const key of Object.keys(next) as (keyof UseAudioAnalyzerOptions)[]) {
    const value = next[key];
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  options = merged;
}

let bindingHandle: CaptureHandle | null = null;
let dspHandle: DspHandle | null = null;
let pollTimer: ReturnType<typeof setInterval> | undefined;
let durationInterval: ReturnType<typeof setInterval> | undefined;
let collected: Float32Array = new Float32Array();
let lastAnalysisFrameAt = 0;

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: "Microphone Permission",
      message: "Vyzorix needs microphone access to capture audio for the scope.",
      buttonNeutral: "Ask Me Later",
      buttonNegative: "Cancel",
      buttonPositive: "OK",
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

function downsampleWaveform(samples: Float32Array, points: number): number[] {
  const n = samples.length;
  if (n === 0) return [];
  if (n <= points) return Array.from(samples);
  const step = Math.ceil(n / points);
  const out: number[] = [];
  for (let i = 0; i < n; i += step) {
    let peak = 0;
    const end = Math.min(i + step, n);
    for (let j = i; j < end; j++) {
      const v = Math.abs(samples[j]);
      if (v > peak) peak = v;
    }
    out.push(samples[i] >= 0 ? peak : -peak);
  }
  return out;
}

async function poll(dspHandle: DspHandle, binding: CaptureHandle) {
  try {
    const raw = await Dsp.readSamples(binding, READ_BLOCK);
    if (raw.length > 0) {
      const frame = new Float32Array(raw);
      // Push the latest window into the scope store so use-mobile-scope's
      // successor logic (measurements + spectrum) can run on the same frame.
      useScopeStore.getState().setSamples(frame, state.sampleRate);

      const rms = await Dsp.computeRms(frame);
      const peak = await Dsp.findPeakAmplitude(frame);
      const frequency = await Dsp.estimateDominantFrequency(frame, state.sampleRate);

      const patch: Partial<AudioAnalyzerState> = {
        volumeLevel: Math.min(rms * 3, 1),
        peakLevel: Math.min(peak, 1),
        vpp: peak * 2,
        frequency,
        waveformData: downsampleWaveform(frame, options.waveformPoints),
      };

      const now = Date.now();
      if (now - lastAnalysisFrameAt > ANALYSIS_FRAME_INTERVAL_MS) {
        lastAnalysisFrameAt = now;
        patch.analysisFrame = frame;
      }

      // Grow the capture buffer (the web hook does the same via collectSamples).
      const next = new Float32Array(collected.length + frame.length);
      next.set(collected);
      next.set(frame, collected.length);
      collected = next;
      patch.samples = collected;

      setState(patch);
    }
  } catch (error) {
    setState({
      error: error instanceof Error ? error : new Error("Capture poll failed"),
    });
  }
}

async function startCapture(): Promise<void> {
  try {
    setState({ error: undefined });
    const { deviceId, desiredSampleRate } = options;
    const sampleRate = desiredSampleRate ?? useAudioStore.getState().sampleRate ?? 48_000;

    const ok = await ensurePermission();
    if (!ok) {
      setState({ error: new Error("Microphone permission denied"), recordingState: "idle" });
      return;
    }

    bindingHandle = await Dsp.createBinding();
    const started = await Dsp.startCapture(bindingHandle, deviceId ?? "default", sampleRate);
    if (!started) {
      setState({ error: new Error("Oboe capture failed to start"), recordingState: "idle" });
      await Dsp.destroyBinding(bindingHandle);
      bindingHandle = null;
      return;
    }
    dspHandle = await Dsp.create();

    collected = new Float32Array();
    setState({
      sampleRate,
      duration: 0,
      recordingState: "recording",
      samples: EMPTY_SAMPLES,
    });

    durationInterval = setInterval(() => {
      if (state.recordingState === "recording") {
        setState({ duration: state.duration + 100 });
      }
    }, 100);

    const binding = bindingHandle;
    const dsp = dspHandle;
    pollTimer = setInterval(() => {
      if (binding != null && dsp != null) {
        void poll(dsp, binding);
      }
    }, POLL_INTERVAL_MS);
  } catch (error) {
    console.error("Failed to start audio capture:", error);
    setState({
      error: error instanceof Error ? error : new Error("Failed to start capture"),
      recordingState: "idle",
    });
  }
}

function pauseCapture() {
  if (state.recordingState !== "recording") return;
  setState({ recordingState: "paused" });
}

function resumeCapture() {
  if (state.recordingState !== "paused") return;
  setState({ recordingState: "recording" });
}

function stopCapture(): Float32Array {
  const captured = collected;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
  if (durationInterval) {
    clearInterval(durationInterval);
    durationInterval = undefined;
  }
  if (bindingHandle != null) {
    void Dsp.stopCapture(bindingHandle);
    void Dsp.destroyBinding(bindingHandle);
    bindingHandle = null;
  }
  if (dspHandle != null) {
    void Dsp.destroy(dspHandle);
    dspHandle = null;
  }
  setState({ samples: captured, recordingState: "idle" });
  return captured;
}

function discardCapture() {
  collected = new Float32Array();
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
  if (durationInterval) {
    clearInterval(durationInterval);
    durationInterval = undefined;
  }
  if (bindingHandle != null) {
    void Dsp.stopCapture(bindingHandle);
    void Dsp.destroyBinding(bindingHandle);
    bindingHandle = null;
  }
  if (dspHandle != null) {
    void Dsp.destroy(dspHandle);
    dspHandle = null;
  }
  state = { ...createInitialState(), sampleRate: state.sampleRate };
  emit();
}

export function useAudioAnalyzer(
  hookOptions: UseAudioAnalyzerOptions = {},
): UseAudioAnalyzerReturn {
  mergeOptions(hookOptions);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const start = useCallback(() => startCapture(), []);

  useEffect(() => {
    return () => {
      if (pollTimer) clearInterval(pollTimer);
      if (durationInterval) clearInterval(durationInterval);
      if (bindingHandle != null) {
        void Dsp.stopCapture(bindingHandle);
        void Dsp.destroyBinding(bindingHandle);
        bindingHandle = null;
      }
      if (dspHandle != null) {
        void Dsp.destroy(dspHandle);
        dspHandle = null;
      }
    };
  }, []);

  return {
    ...snapshot,
    isCapturing: snapshot.recordingState !== "idle",
    startCapture: start,
    pauseCapture,
    resumeCapture,
    stopCapture,
    discardCapture,
  };
}
