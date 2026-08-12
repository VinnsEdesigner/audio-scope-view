// Barrel for the web-aligned stores. Exports match apps/vyzorWeb/src/store/index.ts
// so the ported hooks import from "../store" identically.
export { useAudioStore } from "./audio-store";
export type {
  AudioStore,
  AudioState,
  AudioActions,
  MediaDevice,
  ProcessedAudio,
  SystemAudioInfo,
} from "./audio-store";

export { useWaveformStore } from "./waveform-store";
export type { WaveformStore, WaveformState, WaveformActions, WaveformMessage } from "./waveform-store";

export { useUIStore } from "./ui-store";
export type {
  UIStore,
  UIState,
  UIActions,
  WaveformColor,
  SessionMode,
  TriggerMode,
  ScopeView,
} from "./ui-store";

// Mobile-specific DSP stores (no web equivalent — web holds analyzer state in
// a module-level external store, not zustand). Kept because the native capture
// hooks write DSP results here.
export { useScopeStore } from "./scope-store";
export type { ScopeState } from "./scope-store";

export { useSettingsStore, windowIndex } from "./settings-store";
export type { SettingsState, WindowType } from "./settings-store";
