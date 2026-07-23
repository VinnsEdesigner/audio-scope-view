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

// Audio settings hooks
export { useAudioSettings } from "./use-audio-settings";

// Mobile/Responsive hooks
export { useIsMobile, useIsTablet } from "./use-mobile";

// Theme hooks
export { useTheme } from "./use-theme";

// UI Store
export { useUIStore } from "../store";

// Audio Store (for direct access to sampleRate, bufferSize)
export { useAudioStore } from "../store";

// API Key hooks
export {
  useApiKeys,
  useApiKey,
  useVerifyApiKey,
  useCreateApiKey,
  useUpdateApiKey,
  useDeleteApiKey,
} from "./use-api-keys";
