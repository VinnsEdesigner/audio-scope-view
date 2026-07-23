/**
 * UI Store - General UI state management
 * Manages sidebar, modals, theme, and responsive breakpoints
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Waveform trace color options
export type WaveformColor = "cyan" | "blue" | "purple" | "green" | "orange" | "red";

export interface UIState {
  // Sidebar
  isSidebarOpen: boolean;

  // Modals
  isSettingsModalOpen: boolean;
  isAboutModalOpen: boolean;
  isDeviceSelectorOpen: boolean;

  // Theme
  theme: "light" | "dark" | "system";

  // Display preferences (persisted)
  showGrid: boolean;
  showMeasurements: boolean;
  smoothWaveform: boolean;
  waveformColor: WaveformColor;

  // Responsive
  isMobile: boolean;
  isTablet: boolean;

  // Loading states
  isInitializing: boolean;
}

export interface UIActions {
  // Sidebar actions
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;

  // Modal actions
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  openAboutModal: () => void;
  closeAboutModal: () => void;
  openDeviceSelector: () => void;
  closeDeviceSelector: () => void;

  // Theme actions
  setTheme: (theme: "light" | "dark" | "system") => void;

  // Display preference actions
  setShowGrid: (show: boolean) => void;
  setShowMeasurements: (show: boolean) => void;
  setSmoothWaveform: (smooth: boolean) => void;
  setWaveformColor: (color: WaveformColor) => void;

  // Responsive actions
  setIsMobile: (isMobile: boolean) => void;
  setIsTablet: (isTablet: boolean) => void;

  // Loading actions
  setInitializing: (isInitializing: boolean) => void;

  // Reset
  reset: () => void;
}

export type UIStore = UIState & UIActions;

const initialState: UIState = {
  isSidebarOpen: true,
  isSettingsModalOpen: false,
  isAboutModalOpen: false,
  isDeviceSelectorOpen: false,
  theme: "dark",
  showGrid: true,
  showMeasurements: true,
  smoothWaveform: false,
  waveformColor: "cyan",
  isMobile: false,
  isTablet: false,
  isInitializing: true,
};

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      ...initialState,

      // Sidebar actions
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

      // Modal actions
      openSettingsModal: () => set({ isSettingsModalOpen: true }),
      closeSettingsModal: () => set({ isSettingsModalOpen: false }),
      openAboutModal: () => set({ isAboutModalOpen: true }),
      closeAboutModal: () => set({ isAboutModalOpen: false }),
      openDeviceSelector: () => set({ isDeviceSelectorOpen: true }),
      closeDeviceSelector: () => set({ isDeviceSelectorOpen: false }),

      // Theme actions
      setTheme: (theme) => set({ theme }),

      // Display preference actions
      setShowGrid: (showGrid) => set({ showGrid }),
      setShowMeasurements: (showMeasurements) => set({ showMeasurements }),
      setSmoothWaveform: (smoothWaveform) => set({ smoothWaveform }),
      setWaveformColor: (waveformColor) => set({ waveformColor }),

      // Responsive actions
      setIsMobile: (isMobile) => set({ isMobile }),
      setIsTablet: (isTablet) => set({ isTablet }),

      // Loading actions
      setInitializing: (isInitializing) => set({ isInitializing }),

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: "vyzor-ui-store",
      partialize: (state) => ({
        theme: state.theme,
        showGrid: state.showGrid,
        showMeasurements: state.showMeasurements,
        smoothWaveform: state.smoothWaveform,
        waveformColor: state.waveformColor,
      }),
    },
  ),
);
