

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WaveformColor = "cyan" | "blue" | "purple" | "green" | "orange" | "red";

export interface UIState {
 
 isSidebarOpen: boolean;

 
 isSettingsModalOpen: boolean;
 isAboutModalOpen: boolean;
 isDeviceSelectorOpen: boolean;

 
 theme: "light" | "dark" | "system";

 
 showGrid: boolean;
 showMeasurements: boolean;
 smoothWaveform: boolean;
 waveformColor: WaveformColor;

 
 isMobile: boolean;
 isTablet: boolean;

 
 isInitializing: boolean;
}

export interface UIActions {
 
 toggleSidebar: () => void;
 setSidebarOpen: (isOpen: boolean) => void;

 
 openSettingsModal: () => void;
 closeSettingsModal: () => void;
 openAboutModal: () => void;
 closeAboutModal: () => void;
 openDeviceSelector: () => void;
 closeDeviceSelector: () => void;

 
 setTheme: (theme: "light" | "dark" | "system") => void;

 
 setShowGrid: (show: boolean) => void;
 setShowMeasurements: (show: boolean) => void;
 setSmoothWaveform: (smooth: boolean) => void;
 setWaveformColor: (color: WaveformColor) => void;

 
 setIsMobile: (isMobile: boolean) => void;
 setIsTablet: (isTablet: boolean) => void;

 
 setInitializing: (isInitializing: boolean) => void;

 
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

 
 toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
 setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

 
 openSettingsModal: () => set({ isSettingsModalOpen: true }),
 closeSettingsModal: () => set({ isSettingsModalOpen: false }),
 openAboutModal: () => set({ isAboutModalOpen: true }),
 closeAboutModal: () => set({ isAboutModalOpen: false }),
 openDeviceSelector: () => set({ isDeviceSelectorOpen: true }),
 closeDeviceSelector: () => set({ isDeviceSelectorOpen: false }),

 
 setTheme: (theme) => set({ theme }),

 
 setShowGrid: (showGrid) => set({ showGrid }),
 setShowMeasurements: (showMeasurements) => set({ showMeasurements }),
 setSmoothWaveform: (smoothWaveform) => set({ smoothWaveform }),
 setWaveformColor: (waveformColor) => set({ waveformColor }),

 
 setIsMobile: (isMobile) => set({ isMobile }),
 setIsTablet: (isTablet) => set({ isTablet }),

 
 setInitializing: (isInitializing) => set({ isInitializing }),

 
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
