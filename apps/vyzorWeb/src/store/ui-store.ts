import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WaveformColor = "cyan" | "blue" | "purple" | "green" | "orange" | "red";
export type SessionMode = "live" | "playback";
export type TriggerMode = "auto" | "normal" | "single";
export type ScopeView = "time" | "spectrum" | "spectrogram";

export interface UIState {
  sessionMode: SessionMode;
  isSidebarOpen: boolean;

  isSettingsModalOpen: boolean;
  isAboutModalOpen: boolean;
  isDeviceSelectorOpen: boolean;
  isExportDialogOpen: boolean;

  theme: "light" | "dark" | "system";

  showGrid: boolean;
  showMeasurements: boolean;
  smoothWaveform: boolean;
  waveformColor: WaveformColor;
  glow: boolean;
  autoScale: boolean;
  invert: boolean;

  triggerEdge: "rising" | "falling" | "auto";
  triggerLevel: number;
  triggerMode: TriggerMode;
  triggerEnabled: boolean;
  triggerHoldoff: number;

  scopeView: ScopeView;

  timebase: number;
  verticalGain: number;

  isPlaying: boolean;
  isPaused: boolean;
  playbackSpeed: number;
  loopPlayback: boolean;
  currentPlaybackTime: number;
  playbackDuration: number;

  isMobile: boolean;
  isTablet: boolean;

  isInitializing: boolean;
}

export interface UIActions {
  setSessionMode: (mode: SessionMode) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;

  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  openAboutModal: () => void;
  closeAboutModal: () => void;
  openDeviceSelector: () => void;
  closeDeviceSelector: () => void;
  openExportDialog: () => void;
  closeExportDialog: () => void;

  setTheme: (theme: "light" | "dark" | "system") => void;

  setShowGrid: (show: boolean) => void;
  setShowMeasurements: (show: boolean) => void;
  setSmoothWaveform: (smooth: boolean) => void;
  setWaveformColor: (color: WaveformColor) => void;
  setGlow: (glow: boolean) => void;
  setAutoScale: (autoScale: boolean) => void;
  setInvert: (invert: boolean) => void;

  setTriggerEdge: (edge: "rising" | "falling" | "auto") => void;
  setTriggerLevel: (level: number) => void;
  setTriggerMode: (mode: TriggerMode) => void;
  setTriggerEnabled: (enabled: boolean) => void;
  setTriggerHoldoff: (holdoff: number) => void;
  setScopeView: (view: ScopeView) => void;

  setTimebase: (timebase: number) => void;
  setVerticalGain: (gain: number) => void;

  setIsPlaying: (isPlaying: boolean) => void;
  setIsPaused: (isPaused: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setLoopPlayback: (loop: boolean) => void;
  setCurrentPlaybackTime: (time: number) => void;
  setPlaybackDuration: (duration: number) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;

  setIsMobile: (isMobile: boolean) => void;
  setIsTablet: (isTablet: boolean) => void;

  setInitializing: (isInitializing: boolean) => void;

  reset: () => void;
}

export type UIStore = UIState & UIActions;

const initialState: UIState = {
  sessionMode: "live",
  isSidebarOpen: true,
  isSettingsModalOpen: false,
  isAboutModalOpen: false,
  isDeviceSelectorOpen: false,
  isExportDialogOpen: false,
  theme: "dark",
  showGrid: true,
  showMeasurements: true,
  smoothWaveform: false,
  waveformColor: "cyan",
  glow: false,
  autoScale: true,
  invert: false,
  triggerEdge: "rising",
  triggerLevel: 0,
  triggerMode: "auto",
  triggerEnabled: true,
  triggerHoldoff: 0,
  scopeView: "time",
  timebase: 1024,
  verticalGain: 1,
  isPlaying: false,
  isPaused: false,
  playbackSpeed: 1,
  loopPlayback: false,
  currentPlaybackTime: 0,
  playbackDuration: 0,
  isMobile: false,
  isTablet: false,
  isInitializing: true,
};

export const useUIStore = create<UIStore>()(
  persist(
    (set, _get) => ({
      ...initialState,

      // Override isInitializing after hydration to ensure loading bar shows on fresh load
      setInitializing: (isInitializing) => set({ isInitializing }),

      setSessionMode: (sessionMode) => set({ sessionMode }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

      openSettingsModal: () => set({ isSettingsModalOpen: true }),
      closeSettingsModal: () => set({ isSettingsModalOpen: false }),
      openAboutModal: () => set({ isAboutModalOpen: true }),
      closeAboutModal: () => set({ isAboutModalOpen: false }),
      openDeviceSelector: () => set({ isDeviceSelectorOpen: true }),
      closeDeviceSelector: () => set({ isDeviceSelectorOpen: false }),
      openExportDialog: () => set({ isExportDialogOpen: true }),
      closeExportDialog: () => set({ isExportDialogOpen: false }),

      setTheme: (theme) => set({ theme }),

      setShowGrid: (showGrid) => set({ showGrid }),
      setShowMeasurements: (showMeasurements) => set({ showMeasurements }),
      setSmoothWaveform: (smoothWaveform) => set({ smoothWaveform }),
      setWaveformColor: (waveformColor) => set({ waveformColor }),
      setGlow: (glow) => set({ glow }),
      setAutoScale: (autoScale) => set({ autoScale }),
      setInvert: (invert) => set({ invert }),

      setTriggerEdge: (triggerEdge) => set({ triggerEdge }),
      setTriggerLevel: (triggerLevel) => set({ triggerLevel }),
      setTriggerMode: (triggerMode) => set({ triggerMode }),
      setTriggerEnabled: (triggerEnabled) => set({ triggerEnabled }),
      setTriggerHoldoff: (triggerHoldoff) => set({ triggerHoldoff }),
      setScopeView: (scopeView) => set({ scopeView }),

      setTimebase: (timebase) => set({ timebase }),
      setVerticalGain: (verticalGain) => set({ verticalGain }),

      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setIsPaused: (isPaused) => set({ isPaused }),
      setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
      setLoopPlayback: (loopPlayback) => set({ loopPlayback }),
      setCurrentPlaybackTime: (currentPlaybackTime) => set({ currentPlaybackTime }),
      setPlaybackDuration: (playbackDuration) => set({ playbackDuration }),
      play: () => set({ isPlaying: true, isPaused: false }),
      pause: () => set({ isPlaying: false, isPaused: true }),
      stop: () => set({ isPlaying: false, isPaused: false, currentPlaybackTime: 0 }),

      setIsMobile: (isMobile) => set({ isMobile }),
      setIsTablet: (isTablet) => set({ isTablet }),

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
        glow: state.glow,
        autoScale: state.autoScale,
        invert: state.invert,
        triggerEdge: state.triggerEdge,
        triggerLevel: state.triggerLevel,
        triggerMode: state.triggerMode,
        triggerEnabled: state.triggerEnabled,
        triggerHoldoff: state.triggerHoldoff,
        scopeView: state.scopeView,
        timebase: state.timebase,
        verticalGain: state.verticalGain,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          // Force isInitializing to true after hydration to ensure loading bar shows
          if (state) {
            state.isInitializing = true;
          }
        };
      },
    },
  ),
);
