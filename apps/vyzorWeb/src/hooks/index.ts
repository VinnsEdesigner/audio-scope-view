export {
  useSessions,
  useSessionCount,
  useSessionDetail,
  useStartSession,
  useEndSession,
  useDeleteSession,
  useCaptureWaveform,
} from "./use-sessions";

export {
  useRecordings,
  useRecording,
  useFullRecording,
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
export type { RecordingSummary } from "./use-recordings";

export {
  useSessionsWithStatus,
  useActiveSessionsWithStatus,
  useSessionStatusCounts,
  useHomePageSessions,
} from "./use-sessions-with-status";
export type { SessionWithStatus } from "./use-sessions-with-status";

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
export type { WaveformColor, SessionMode } from "../store";

export { useToast } from "./use-toast";

export {
  useApiKeys,
  useApiKey,
  useVerifyApiKey,
  useCreateApiKey,
  useUpdateApiKey,
  useDeleteApiKey,
} from "./use-api-keys";

export { useSessionDialogs } from "./use-session-dialogs";
export type { Recording } from "./use-session-dialogs";

export { useChunkedPlayback } from "./use-chunked-playback";
export type {
  ChunkedPlaybackState,
  ChunkedPlaybackOptions,
  ChunkedPlaybackReturn,
} from "./use-chunked-playback";

export { useStreamingPlayback } from "@/audio";
export type {
  StreamingPlaybackState,
  StreamingPlaybackOptions,
  StreamingPlaybackReturn,
} from "@/audio";
