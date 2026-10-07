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
  /** Whether the generator is feeding the scope (independent of the dialog). */
  active: boolean;
  setActive: (active: boolean) => void;
  toggleActive: () => void;
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

export function useWaveformGenerator(
  options: UseWaveformGeneratorOptions = {},
): UseWaveformGeneratorReturn {
  // `fftSize` is the capture buffer size (Settings → Buffer Size) so the
  // generator produces the SAME analysis-frame length as the live analyzer.
  // Otherwise the generator's spectrum would use a different FFT size than
  // capture mode and the two spectra would look different.
  const { sampleRate = 48_000, fftSize = 512 } = options;
  const frameSamples = fftSize;

  const [settings, setSettings] = React.useState<WaveformGeneratorSettings>(DEFAULT_SETTINGS);
  const [recordingState, setRecordingState] = React.useState<RecordingState>("idle");
  const [error, setError] = React.useState<Error | undefined>(undefined);
  // Whether the generator is actively feeding the scope. Toggled from the top
  // bar; once on it keeps running after the settings dialog is closed.
  const [active, setActive] = React.useState(false);

  // The generated buffer — the same Float32Array is reused (no per-frame alloc).
  const samplesReference = React.useRef<Float32Array>(new Float32Array(frameSamples));
  const [waveformData, setWaveformData] = React.useState<number[]>([]);

  React.useEffect(() => {
    void ensureDsp();
  }, []);

  // Regenerate the buffer whenever settings change, then stream through it in
  // real time (advancing a cursor by the elapsed wall-clock) so the generator
  // behaves like a continuous signal — the trace animates and the trigger has a
  // changing phase to lock onto. Without this, each frame started at phase 0 and
  // the trace looked frozen.
  React.useEffect(() => {
    if (!active) return;
    let rafId: number;
    let cancelled = false;
    // Generate a longer buffer (backing) than the window we display. We read
    // CONTIGUOUS windows from it, advancing by the elapsed wall-clock. A
    // contiguous window is essential: wrapping a window across the buffer seam
    // creates a discontinuity that smears the spectrum (high noise floor).
    const backingSamples = Math.max(frameSamples * 4, frameSamples + 2048);
    let buffer: Float32Array | null = null;
    let cursor = 0;
    let lastNow = 0;

    const regenerate = () => {
      const dsp = getDsp();
      if (!dsp) return false;
      try {
        buffer = dsp.generateWaveform({
          kind: settings.kind,
          frequency: settings.frequency,
          amplitude: settings.amplitude,
          noiseType: settings.noiseType,
          sampleRate,
          numSamples: backingSamples,
        });
        samplesReference.current = buffer;
        return true;
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        return false;
      }
    };

    const loop = (now: number) => {
      if (cancelled || !buffer) return;
      const elapsedMs = lastNow ? now - lastNow : 1000 / 60;
      lastNow = now;
      const advance = Math.round((sampleRate * Math.min(elapsedMs, 100)) / 1000);
      // Advance, then clamp so the contiguous window [cursor, cursor+frame) is
      // always fully inside the backing buffer — never wrapping.
      cursor = Math.min(cursor + advance, buffer.length - frameSamples);

      // Copy a CONTIGUOUS frame (no wrap-around) so the spectrum stays clean.
      const frame = buffer.slice(cursor, cursor + frameSamples);
      if (cursor >= buffer.length - frameSamples) {
        // Reached the end — regenerate a fresh buffer and start over. The new
        // buffer begins at phase 0, which is a clean loop point.
        if (regenerate()) {
          cursor = 0;
        }
      }

      setWaveformData(Array.from(frame));
      samplesReference.current = frame;
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
  }, [settings, sampleRate, active, frameSamples]);

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
    windowMs: (frameSamples / sampleRate) * 1000,
    isCapturing,
    error,
    active,
    setActive,
    toggleActive: () => setActive((a) => !a),
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
