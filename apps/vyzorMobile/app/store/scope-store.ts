// Scope store — DSP results produced by the JSI DspModule.
import { create } from "zustand";
import type { Spectrum, WaveformMeasurements } from "../lib/native-dsp-bridge";

export interface ScopeState {
  samples: Float32Array;
  sampleRate: number;
  measurements: WaveformMeasurements | null;
  spectrum: Spectrum | null;
  isProcessing: boolean;
  lastError: string | null;

  setSamples: (samples: Float32Array, sampleRate: number) => void;
  setMeasurements: (m: WaveformMeasurements | null) => void;
  setSpectrum: (s: Spectrum | null) => void;
  setProcessing: (p: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

export const useScopeStore = create<ScopeState>((set) => ({
  samples: new Float32Array(0),
  sampleRate: 48000,
  measurements: null,
  spectrum: null,
  isProcessing: false,
  lastError: null,

  setSamples: (samples, sampleRate) => set({ samples, sampleRate }),
  setMeasurements: (measurements) => set({ measurements }),
  setSpectrum: (spectrum) => set({ spectrum }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setError: (lastError) => set({ lastError }),
  reset: () =>
    set({
      samples: new Float32Array(0),
      measurements: null,
      spectrum: null,
      isProcessing: false,
      lastError: null,
    }),
}));
