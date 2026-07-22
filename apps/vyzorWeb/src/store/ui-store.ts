/**
 * UI Store - General UI state management
 * Manages sidebar, modals, theme, and responsive breakpoints
 */

import { create } from "zustand";

export interface UIState {
  // Sidebar
  isSidebarOpen: boolean;

  // Modals
  isSettingsModalOpen: boolean;
  isAboutModalOpen: boolean;
  isDeviceSelectorOpen: boolean;

  // Theme
  theme: "light" | "dark" | "system";

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
  theme: "system",
  isMobile: false,
  isTablet: false,
  isInitializing: true,
};

export const useUIStore = create<UIStore>((set) => ({
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

  // Responsive actions
  setIsMobile: (isMobile) => set({ isMobile }),
  setIsTablet: (isTablet) => set({ isTablet }),

  // Loading actions
  setInitializing: (isInitializing) => set({ isInitializing }),

  // Reset
  reset: () => set(initialState),
}));
