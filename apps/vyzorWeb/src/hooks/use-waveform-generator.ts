// use-waveform-generator.ts — C++-backed signal generator hook (replaces test mode).
//
// The old `use-mock-audio-analyzer` had two coexisting synth paths: a C++
// `dsp.generateWaveform` call AND a buggy live OscillatorNode/AnalyserNode path
// that did not produce a usable waveform (the reported "test mode is buggy /
// non-functioning" issue). This hook keeps ONLY the C++ path: it asks the WASM
// DSP core to render a buffer for the configured waveform and exposes it as an
// AudioAnalyzerState (the same shape the real `useAudioAnalyzer` returns), so
// scope-page can swap it in for the live analyzer with no other changes.
//
// The generator is driven by a rAF loop so the scope's internal renderer keeps
// animating; the buffer is regenerated only when generator settings change.

import * as React from "react";
import { ensureDsp, getDsp } from "@/lib/dsp-loader";
import type { GeneratorKind, NoiseType } from "@audio-scope-view/dsp-wasm";
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

  // The generated buffer — the same Float32Array is reused (no per-frame alloc).
  const samplesReference = React.useRef<Float32Array>(new Float32Array(BUFFER_SAMPLES));
  const [waveformData, setWaveformData] = React.useState<number[]>([]);

  React.useEffect(() => {
    void ensureDsp();
  }, []);

  // Regenerate the buffer whenever settings or sampleRate change, then keep
  // it live via rAF so the scope animates. The buffer is regenerated only on
  // settings change; rAF just re-publishes the same samples (cheap) so the
  // scope's internal renderer keeps its animation loop fed.
  React.useEffect(() => {
    let rafId: number;
    let cancelled = false;

    const regenerate = () => {
      const dsp = getDsp();
      if (!dsp) return false;
      try {
        const buf = dsp.generateWaveform({
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
      // Publish a downsampled copy for the waveform display (the scope draws
      // from waveformData; the full-res frame is analysisFrame).
      setWaveformData(Array.from(buf));
      rafId = requestAnimationFrame(loop);
    };

    // Try to regenerate; if the DSP isn't loaded yet, retry until it is.
    const tryGenerate = () => {
      if (regenerate()) {
        rafId = requestAnimationFrame(loop);
      } else {
        // DSP not ready yet — retry shortly.
        rafId = requestAnimationFrame(tryGenerate);
      }
    };
    tryGenerate();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
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
