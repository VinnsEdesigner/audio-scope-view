// Dashboard hooks
export { useDashboardSummary, useRecentScopes } from "./use-dashboard-summary";

// Scope hooks
export {
  useScopes,
  useActiveScopes,
  useScopeCount,
  useScopeDetail,
  useCreateScope,
  useUpdateScope,
  useDeleteScope,
  useCaptureWaveform,
} from "./use-scopes";

// Settings hooks
export { useSettings, useUpdateSettings } from "./use-settings";

// Waveform hooks
export { useWaveformStream, useSubmitWaveform } from "./use-waveform-stream";

// Audio context hooks
export { useAudioContext } from "./use-audio-context";

// Media devices hooks
export { useMediaDevices } from "./use-media-devices";

// Mobile/Responsive hooks
export { useIsMobile, useIsTablet } from "./use-mobile";
