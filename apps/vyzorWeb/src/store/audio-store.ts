/**
 * Audio Store - Browser audio capture and media device state
 * Manages audio context, device selection, and capture state
 */

import { create } from "zustand";

export interface MediaDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export interface ProcessedAudio {
  samples: Float32Array;
  sampleRate: number;
  timestamp: number;
  channels: number;
}

export interface AudioState {
  // Capture state
  isCapturing: boolean;
  stream: MediaStream | undefined;
  error: Error | undefined;
  processedAudio: ProcessedAudio | undefined;

  // Device state
  devices: MediaDevice[];
  selectedDeviceId: string | undefined;
  permissionState: PermissionState;

  // Audio settings
  sampleRate: number;
  bufferSize: number;

  // Audio context (stored as reference, not serializable)
  audioContext: AudioContext | undefined;
}

export interface AudioActions {
  // Capture actions
  setCapturing: (isCapturing: boolean) => void;
  setStream: (stream: MediaStream | undefined) => void;
  setError: (error: Error | undefined) => void;
  setProcessedAudio: (audio: ProcessedAudio | undefined) => void;
  setAudioContext: (context: AudioContext | undefined) => void;

  // Device actions
  setDevices: (devices: MediaDevice[]) => void;
  setSelectedDeviceId: (deviceId: string | undefined) => void;
  setPermissionState: (state: PermissionState) => void;

  // Audio settings actions
  setSampleRate: (sampleRate: number) => void;
  setBufferSize: (bufferSize: number) => void;

  // Combined actions
  resetCapture: () => void;
  resetDevices: () => void;
  resetAll: () => void;
}

export type AudioStore = AudioState & AudioActions;

const initialState: AudioState = {
  isCapturing: false,
  stream: undefined,
  error: undefined,
  processedAudio: undefined,
  devices: [],
  selectedDeviceId: undefined,
  permissionState: "prompt",
  sampleRate: 48000,
  bufferSize: 512,
  audioContext: undefined,
};

export const useAudioStore = create<AudioStore>((set) => ({
  ...initialState,

  // Capture actions
  setCapturing: (isCapturing) => set({ isCapturing }),
  setStream: (stream) => set({ stream }),
  setError: (error) => set({ error }),
  setProcessedAudio: (processedAudio) => set({ processedAudio }),
  setAudioContext: (audioContext) => set({ audioContext }),

  // Device actions
  setDevices: (devices) => set({ devices }),
  setSelectedDeviceId: (selectedDeviceId) =>
    set((state) => {
      // Auto-select first device if setting to undefined and devices exist
      const shouldAutoSelect = selectedDeviceId === undefined && state.devices.length > 0;
      return {
        selectedDeviceId: shouldAutoSelect ? state.devices[0].deviceId : selectedDeviceId,
      };
    }),
  setPermissionState: (permissionState) => set({ permissionState }),

  // Audio settings actions
  setSampleRate: (sampleRate) => set({ sampleRate }),
  setBufferSize: (bufferSize) => set({ bufferSize }),

  // Combined actions
  resetCapture: () =>
    set({
      isCapturing: false,
      stream: undefined,
      error: undefined,
      processedAudio: undefined,
      audioContext: undefined,
    }),

  resetDevices: () =>
    set({
      devices: [],
      selectedDeviceId: undefined,
    }),

  resetAll: () => set(initialState),
}));
