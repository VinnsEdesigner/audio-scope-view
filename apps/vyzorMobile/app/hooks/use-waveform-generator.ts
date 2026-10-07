// use-waveform-generator.ts — RN port of the web hook. The web version renders
// a buffer via the WASM DSP core (dsp.generateWaveform) on a rAF loop; on RN
// the buffer comes from the native Dsp.generateWaveform (C++ generators via
// JNI). The exposed AudioAnalyzerState + return shape matches the web hook so
// the scope screen swaps it in for the live analyzer with no other changes.
//
// rAF exists on RN (polyfilled by the bridge) but is low-frequency; a timer
// drives the publish loop at ~60 Hz instead.
import * as React from "react";
import { Dsp } from "../lib/native-dsp-bridge";
import type { GeneratorKind, NoiseType } from "../lib/native-dsp-bridge";
import type { AudioAnalyzerState, RecordingState } from "./use-audio-analyzer";

export interface WaveformGeneratorSettings {
  kind: GeneratorKind;
  frequency: number;
  amplitude: number;
  noiseType: NoiseType;
}

export interface UseWaveformGeneratorReturn extends AudioAnalyzerState {
  isCapturing: boolean;
  error: Error | undefined;
  startCapture: () => void;
  pauseCapture: () => void;
  resumeCapture: () => void;
  stopCapture: () => void;
  discardCapture: () => void;
  setKind: (kind: GeneratorKind) => void;
  setFrequency: (frequency: number) => void;
  setAmplitude: (amplitude: number) => void;
  setNoiseType: (noiseType: NoiseType) => void;
  settings: WaveformGeneratorSettings;
}

interface UseWaveformGeneratorOptions {
  sampleRate?: number;
  smoothingTimeConstant?: number;
  fftSize?: number;
}

const DEFAULT_SETTINGS: WaveformGeneratorSettings = {
  kind: "sine",
  frequency: 440,
  amplitude: 0.8,
  noiseType: "white",
};

// Buffer length matches the real analyzer's analysisFrame so the scope renderer
// and spectrum/trigger see the same window sizes as a live signal.
const BUFFER_SAMPLES = 2048;

export function useWaveformGenerator(
  options: UseWaveformGeneratorOptions = {},
): UseWaveformGeneratorReturn {
  const { sampleRate = 48_000, fftSize = 2048 } = options;

  const [settings, setSettings] = React.useState<WaveformGeneratorSettings>(DEFAULT_SETTINGS);
  const [recordingState, setRecordingState] = React.useState<RecordingState>("idle");
  const [error, setError] = React.useState<Error | undefined>(undefined);

  const samplesReference = React.useRef<Float32Array>(new Float32Array(BUFFER_SAMPLES));
  const [waveformData, setWaveformData] = React.useState<number[]>([]);

  // Regenerate the buffer whenever settings or sampleRate change, then keep it
  // live via a timer so the scope animates. The buffer is regenerated only on
  // settings change; the timer re-publishes the same samples (cheap).
  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    let cancelled = false;

    const regenerate = async () => {
      try {
        const buf = await Dsp.generateWaveform({
          kind: settings.kind,
          frequency: settings.frequency,
          amplitude: settings.amplitude,
          noiseType: settings.noiseType,
          sampleRate,
          numSamples: BUFFER_SAMPLES,
        });
        samplesReference.current = buf;
        return true;
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        return false;
      }
    };

    const loop = () => {
      if (cancelled) return;
      const buf = samplesReference.current;
      setWaveformData(Array.from(buf));
    };

    void regenerate().then((ok) => {
      if (ok && !cancelled) {
        timer = setInterval(loop, 16);
      }
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [settings, sampleRate]);

  const isCapturing = recordingState === "recording";

  return {
    recordingState,
    volumeLevel: settings.amplitude,
    peakLevel: settings.amplitude,
    waveformData,
    sampleRate,
    duration: 0,
    samples: samplesReference.current,
    analysisFrame: samplesReference.current,
    vpp: settings.amplitude * 2,
    frequency: settings.frequency,
    windowMs: (BUFFER_SAMPLES / sampleRate) * 1000,
    isCapturing,
    error,
    startCapture: () => setRecordingState("recording"),
    pauseCapture: () => setRecordingState("paused"),
    resumeCapture: () => setRecordingState("recording"),
    stopCapture: () => setRecordingState("idle"),
    discardCapture: () => setRecordingState("idle"),
    setKind: (kind) => setSettings((s) => ({ ...s, kind })),
    setFrequency: (frequency) => setSettings((s) => ({ ...s, frequency })),
    setAmplitude: (amplitude) => setSettings((s) => ({ ...s, amplitude })),
    setNoiseType: (noiseType) => setSettings((s) => ({ ...s, noiseType })),
    settings,
  };
}
