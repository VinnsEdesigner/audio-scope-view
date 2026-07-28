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

export {
  useRecordings,
  useRecording,
  useRecentRecordings,
  useRecordingStats,
  useRenameRecording,
  usePinRecording,
  useDeleteRecording,
  usePinRecordings,
  useDeleteRecordings,
  useStartRecording,
  useStopRecording,
  usePauseRecording,
  useResumeRecording,
} from "./use-recordings";

export {
  useScopesWithStatus,
  useActiveScopesWithStatus,
  useScopeStatusCounts,
  useHomePageScopes,
} from "./use-scopes-with-status";

export { useSettings, useUpdateSettings } from "./use-settings";

export { useWaveformStream, useSubmitWaveform } from "./use-waveform-stream";

export { useAudioContext } from "./use-audio-context";

export { useMediaDevices } from "./use-media-devices";

export { useAudioAnalyzer } from "./use-audio-analyzer";

export { useMockAudioAnalyzer } from "./use-mock-audio-analyzer";
export type { WaveformType } from "./use-mock-audio-analyzer";

export { useExport } from "./use-export";

export {
  formatBytes,
  formatDuration,
  formatDurationLong,
  formatTimestampRelative,
} from "@audio-scope-view/api-client/domain/_shared/audio-utilities";

export { useAudioSettings } from "./use-audio-settings";

export { useIsMobile, useIsTablet } from "./use-mobile";

export { useTheme } from "./use-theme";

export { useUIStore, useAudioStore } from "../store";
export type { WaveformColor, ScopeMode } from "../store";

export { useToast } from "./use-toast";

export {
  useApiKeys,
  useApiKey,
  useVerifyApiKey,
  useCreateApiKey,
  useUpdateApiKey,
  useDeleteApiKey,
} from "./use-api-keys";

export { useScopeDialogs } from "./use-scope-dialogs";
export type { Recording } from "./use-scope-dialogs";
