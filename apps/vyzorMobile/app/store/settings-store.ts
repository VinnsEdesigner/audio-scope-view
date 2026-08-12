// Settings store — capture + DSP configuration, persisted to device.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { AsyncStorage } from "../lib/async-storage";

export type WindowType = "rectangular" | "hann" | "hamming" | "blackman";

/**
 * Where session data is persisted.
 * - "server": the deployed Rust server (Turso/local SQLite), via Apollo.
 * - "local":  on-device Android Room SQLite; syncs to the server when online
 *   (server-optional local mode, impl spec Step 8).
 */
export type PersistenceMode = "server" | "local";

export interface SettingsState {
  sampleRate: number;
  fftSize: number;
  windowType: WindowType;
  deviceId: string;
  showPhases: boolean;
  captureMode: "continuous" | "single-shot";
  persistenceMode: PersistenceMode;

  setSampleRate: (r: number) => void;
  setFftSize: (n: number) => void;
  setWindowType: (w: WindowType) => void;
  setDeviceId: (id: string) => void;
  setShowPhases: (s: boolean) => void;
  setCaptureMode: (m: "continuous" | "single-shot") => void;
  setPersistenceMode: (m: PersistenceMode) => void;
}

const WINDOW_INDEX: Record<WindowType, 0 | 1 | 2 | 3> = {
  rectangular: 0,
  hann: 1,
  hamming: 2,
  blackman: 3,
};

export const windowIndex = (w: WindowType) => WINDOW_INDEX[w];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sampleRate: 48000,
      fftSize: 2048,
      windowType: "hann",
      deviceId: "default",
      showPhases: false,
      captureMode: "continuous",
      persistenceMode: "server",

      setSampleRate: (sampleRate) => set({ sampleRate }),
      setFftSize: (fftSize) => set({ fftSize }),
      setWindowType: (windowType) => set({ windowType }),
      setDeviceId: (deviceId) => set({ deviceId }),
      setShowPhases: (showPhases) => set({ showPhases }),
      setCaptureMode: (captureMode) => set({ captureMode }),
      setPersistenceMode: (persistenceMode) => set({ persistenceMode }),
    }),
    {
      name: "audioscope-settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
