// audio-store.ts — RN analog of the web audio-store. The web store carries
// browser-only fields (MediaStream, AudioContext, SystemAudioInfo with
// userAgent/browserName); on RN capture runs through Oboe (see use-audio-
// analyzer), so those fields are dropped. The device list, capture settings,
// and selected-device plumbing stay so the transport hooks have the same
// surface.
//
// Persisted fields (sampleRate, bufferSize) survive restarts via AsyncStorage;
// the capture/permission/device fields are transient.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { AsyncStorage } from "../lib/async-storage";

export interface MediaDevice {
  deviceId: string;
  label: string;
  /** "audioinput" on RN (parity with the web MediaDeviceKind value). */
  kind: string;
  groupId: string;
}

export interface SystemAudioInfo {
  platform: string;
  supportedSampleRates: number[];
  defaultSampleRate: number;
  maxChannels: number;
}

export interface ProcessedAudio {
  samples: Float32Array;
  sampleRate: number;
  timestamp: number;
  channels: number;
}

export interface AudioState {
  isCapturing: boolean;
  error: Error | undefined;
  processedAudio: ProcessedAudio | undefined;

  devices: MediaDevice[];
  selectedDeviceId: string | undefined;
  /** "prompt" | "granted" | "denied" — mirrors the web PermissionState union. */
  permissionState: "prompt" | "granted" | "denied";

  systemInfo: SystemAudioInfo | undefined;

  sampleRate: number;
  bufferSize: number;
}

export interface AudioActions {
  setCapturing: (isCapturing: boolean) => void;
  setError: (error: Error | undefined) => void;
  setProcessedAudio: (audio: ProcessedAudio | undefined) => void;

  setDevices: (devices: MediaDevice[]) => void;
  setSelectedDeviceId: (deviceId: string | undefined) => void;
  setPermissionState: (state: "prompt" | "granted" | "denied") => void;
  setSystemInfo: (info: SystemAudioInfo | undefined) => void;

  setSampleRate: (sampleRate: number) => void;
  setBufferSize: (bufferSize: number) => void;

  resetCapture: () => void;
  resetDevices: () => void;
  resetAll: () => void;
}

export type AudioStore = AudioState & AudioActions;

const initialState: AudioState = {
  isCapturing: false,
  error: undefined,
  processedAudio: undefined,
  devices: [],
  selectedDeviceId: undefined,
  permissionState: "prompt",
  systemInfo: undefined,
  sampleRate: 48_000,
  bufferSize: 512,
};

export const useAudioStore = create<AudioStore>()(
  persist(
    (set) => ({
      ...initialState,

      setCapturing: (isCapturing) => set({ isCapturing }),
      setError: (error) => set({ error }),
      setProcessedAudio: (processedAudio) => set({ processedAudio }),

      setDevices: (devices) => set({ devices }),
      setSelectedDeviceId: (selectedDeviceId) =>
        set((state) => {
          const shouldAutoSelect = selectedDeviceId === undefined && state.devices.length > 0;
          return {
            selectedDeviceId: shouldAutoSelect ? state.devices[0].deviceId : selectedDeviceId,
          };
        }),
      setPermissionState: (permissionState) => set({ permissionState }),
      setSystemInfo: (systemInfo) => set({ systemInfo }),

      setSampleRate: (sampleRate) => set({ sampleRate }),
      setBufferSize: (bufferSize) => set({ bufferSize }),

      resetCapture: () =>
        set({ isCapturing: false, error: undefined, processedAudio: undefined }),

      resetDevices: () => set({ devices: [], selectedDeviceId: undefined }),

      resetAll: () => set(initialState),
    }),
    {
      name: "vyzor-audio-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sampleRate: state.sampleRate,
        bufferSize: state.bufferSize,
      }),
    },
  ),
);
