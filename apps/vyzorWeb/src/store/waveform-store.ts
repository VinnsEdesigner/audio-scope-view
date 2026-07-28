import { create } from "zustand";

export interface WaveformMessage {
  type: "waveform";
  scopeId: string;
  samples: number[];
  sampleRate: number;
  timestamp: number;
}

export interface WaveformState {
  isConnected: boolean;
  error: Error | undefined;
  scopeId: string | undefined;

  waveform: WaveformMessage | undefined;

  buffer: WaveformMessage[];

  maxBufferSize: number;
}

export interface WaveformActions {
  setConnected: (isConnected: boolean) => void;
  setScopeId: (scopeId: string | undefined) => void;
  setError: (error: Error | undefined) => void;

  setWaveform: (waveform: WaveformMessage) => void;
  addToBuffer: (waveform: WaveformMessage) => void;
  clearBuffer: () => void;

  setMaxBufferSize: (size: number) => void;

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

  setConnected: (isConnected) => set({ isConnected }),
  setScopeId: (scopeId) => set({ scopeId }),
  setError: (error) => set({ error }),

  setWaveform: (waveform) =>
    set((state) => {
      const newBuffer = [...state.buffer, waveform];

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

  setMaxBufferSize: (maxBufferSize) => set({ maxBufferSize }),

  reset: () => set(initialState),
}));
