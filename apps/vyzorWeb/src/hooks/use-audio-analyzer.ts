import { useCallback, useSyncExternalStore } from "react";
import {
  calculateRMS,
  calculatePeak,
  calculateFrequency,
  downsampleWaveform,
  collectSamples,
} from "@audio-scope-view/api-client/domain/_shared/audio-utilities";
import { useAudioStore } from "../store";

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
const DEFAULT_SMOOTHING = 0.3;
const DEFAULT_WAVEFORM_POINTS = 256;
const DEFAULT_SAMPLE_INTERVAL = 16;
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
  smoothingTimeConstant: DEFAULT_SMOOTHING,
  waveformPoints: DEFAULT_WAVEFORM_POINTS,
  sampleCollectionInterval: DEFAULT_SAMPLE_INTERVAL,
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

let audioContext: AudioContext | undefined;
let analyser: AnalyserNode | undefined;
let mediaStream: MediaStream | undefined;
let animationFrameId: number | undefined;
let durationInterval: ReturnType<typeof setInterval> | undefined;
let collected: Float32Array = new Float32Array();

function cleanup() {
  if (animationFrameId !== undefined) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = undefined;
  }
  if (durationInterval !== undefined) {
    clearInterval(durationInterval);
    durationInterval = undefined;
  }
  if (mediaStream) {
    for (const track of mediaStream.getTracks()) track.stop();
    mediaStream = undefined;
  }
  if (audioContext) {
    void audioContext.close();
    audioContext = undefined;
  }
  analyser = undefined;
}

async function startCapture(): Promise<void> {
  try {
    setState({ error: undefined });
    cleanup();

    const { deviceId, desiredSampleRate, fftSize, smoothingTimeConstant, waveformPoints } = options;

    const audioConstraints: MediaTrackConstraints = {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      echoCancellation: { exact: false },
      noiseSuppression: { exact: false },
      autoGainControl: { exact: false },
    };

    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });

    const contextOptions: AudioContextOptions = {};
    if (desiredSampleRate) contextOptions.sampleRate = desiredSampleRate;

    const context = new AudioContext(contextOptions);
    const source = context.createMediaStreamSource(stream);
    const node = context.createAnalyser();

    node.fftSize = fftSize;
    node.smoothingTimeConstant = smoothingTimeConstant;
    source.connect(node);

    mediaStream = stream;
    audioContext = context;
    analyser = node;
    collected = new Float32Array();

    setState({
      sampleRate: context.sampleRate,
      duration: 0,
      recordingState: "recording",
      samples: EMPTY_SAMPLES,
    });

    durationInterval = setInterval(() => {
      if (state.recordingState === "recording") {
        setState({ duration: state.duration + 100 });
      }
    }, 100);

    // Float time-domain data: full precision. The byte API quantises to 1/128
    // steps which turns near-silent input into visible square-ish pulses.
    const timeDomain = new Float32Array(node.fftSize);
    const byteBuffer = new Uint8Array(node.frequencyBinCount);
    let lastAnalysisFrameAt = 0;

    const tick = () => {
      if (!analyser || !audioContext || state.recordingState === "idle") return;

      if (state.recordingState === "recording") {
        analyser.getFloatTimeDomainData(timeDomain);
        const normalized = timeDomain.slice();
        const rms = calculateRMS(normalized);
        const peak = calculatePeak(normalized);
        const frequency = calculateFrequency(normalized, audioContext.sampleRate);

        const patch: Partial<AudioAnalyzerState> = {
          volumeLevel: Math.min(rms * 3, 1),
          peakLevel: Math.min(peak, 1),
          vpp: peak * 2,
          frequency,
          waveformData: downsampleWaveform(normalized, options.waveformPoints ?? waveformPoints),
        };

        const now = performance.now();
        if (now - lastAnalysisFrameAt > ANALYSIS_FRAME_INTERVAL_MS) {
          lastAnalysisFrameAt = now;
          patch.analysisFrame = normalized;
        }

        setState(patch);

        analyser.getByteTimeDomainData(byteBuffer);
        const chunk = collectSamples(byteBuffer, options.sampleCollectionInterval);
        const next = new Float32Array(collected.length + chunk.length);
        next.set(collected);
        next.set(chunk, collected.length);
        collected = next;
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    tick();
  } catch (error) {
    console.error("Failed to start audio capture:", error);
    setState({
      error: error instanceof Error ? error : new Error("Failed to start capture"),
      recordingState: "idle",
    });
    cleanup();
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
  cleanup();
  setState({ samples: captured, recordingState: "idle" });
  return captured;
}

function discardCapture() {
  collected = new Float32Array();
  cleanup();
  state = { ...createInitialState(), sampleRate: state.sampleRate };
  emit();
}

export function useAudioAnalyzer(
  hookOptions: UseAudioAnalyzerOptions = {},
): UseAudioAnalyzerReturn {
  mergeOptions(hookOptions);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const start = useCallback(() => startCapture(), []);

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
