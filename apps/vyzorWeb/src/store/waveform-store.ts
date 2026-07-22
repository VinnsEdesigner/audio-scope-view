/**
 * Waveform Store - WebSocket streaming state for oscilloscope data
 * Manages real-time waveform connection, data buffer, and display state
 */

import { create } from "zustand";

export interface WaveformMessage {
  type: "waveform";
  scopeId: string;
  samples: number[];
  sampleRate: number;
  timestamp: number;
}

export interface WaveformState {
  // Connection state
  isConnected: boolean;
  error: Error | undefined;
  scopeId: string | undefined;

  // Current waveform data
  waveform: WaveformMessage | undefined;

  // Display buffer (rolling window of recent waveforms)
  buffer: WaveformMessage[];

  // Buffer settings
  maxBufferSize: number;
}

export interface WaveformActions {
  // Connection actions
  setConnected: (isConnected: boolean) => void;
  setScopeId: (scopeId: string | undefined) => void;
  setError: (error: Error | undefined) => void;

  // Waveform actions
  setWaveform: (waveform: WaveformMessage) => void;
  addToBuffer: (waveform: WaveformMessage) => void;
  clearBuffer: () => void;

  // Settings actions
  setMaxBufferSize: (size: number) => void;

  // Reset
  reset: () => void;
}

export type WaveformStore = WaveformState & WaveformActions;

const initialState: WaveformState = {
  isConnected: false,
  error: undefined,
  scopeId: undefined,
  waveform: undefined,
  buffer: [],
  maxBufferSize: 10,
};

export const useWaveformStore = create<WaveformStore>((set) => ({
  ...initialState,

  // Connection actions
  setConnected: (isConnected) => set({ isConnected }),
  setScopeId: (scopeId) => set({ scopeId }),
  setError: (error) => set({ error }),

  // Waveform actions
  setWaveform: (waveform) =>
    set((state) => {
      const newBuffer = [...state.buffer, waveform];
      // Keep only last maxBufferSize items
      if (newBuffer.length > state.maxBufferSize) {
        newBuffer.shift();
      }
      return { waveform, buffer: newBuffer };
    }),

  addToBuffer: (waveform) =>
    set((state) => {
      const newBuffer = [...state.buffer, waveform];
      if (newBuffer.length > state.maxBufferSize) {
        newBuffer.shift();
      }
      return { buffer: newBuffer };
    }),

  clearBuffer: () => set({ buffer: [], waveform: undefined }),

  // Settings actions
  setMaxBufferSize: (maxBufferSize) => set({ maxBufferSize }),

  // Reset
  reset: () => set(initialState),
}));
