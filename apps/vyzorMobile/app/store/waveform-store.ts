// waveform-store.ts — verbatim port of the web waveform-store. It is
// transport-agnostic (no browser APIs): it just holds the latest waveform
// message and a rolling buffer. The WS connection lives in use-waveform-stream.
import { create } from "zustand";

export interface WaveformMessage {
  type: "waveform";
  sessionId: string;
  samples: number[];
  sampleRate: number;
  timestamp: number;
}

export interface WaveformState {
  isConnected: boolean;
  error: Error | undefined;
  sessionId: string | undefined;

  waveform: WaveformMessage | undefined;

  buffer: WaveformMessage[];

  maxBufferSize: number;
}

export interface WaveformActions {
  setConnected: (isConnected: boolean) => void;
  setSessionId: (sessionId: string | undefined) => void;
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
  sessionId: undefined,
  waveform: undefined,
  buffer: [],
  maxBufferSize: 10,
};

export const useWaveformStore = create<WaveformStore>((set) => ({
  ...initialState,

  setConnected: (isConnected) => set({ isConnected }),
  setSessionId: (sessionId) => set({ sessionId }),
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
