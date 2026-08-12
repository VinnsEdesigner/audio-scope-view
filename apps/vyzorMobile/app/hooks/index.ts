// Barrel for the web-aligned hooks. Mirrors apps/vyzorWeb/src/hooks/index.ts
// so screens/components can import from "./hooks" identically.
//
// Deliberately omitted vs. the web barrel:
//  - useApiKeys/*            : API keys are not used in the mobile app (per the
//                              port spec — the mobile identity is device-id only).
//  - useToast                : no RN toast system yet (deferred to the
//                              components phase; use-session-dialogs logs instead).
//  - useAudioContext         : Web Audio AudioContext — RN capture runs through
//                              Oboe (see use-audio-analyzer), so this has no
//                              RN equivalent.

export {
  useSessions,
  useSessionCount,
  useSessionDetail,
  useSubSessions,
  useParentSession,
  useStartSession,
  useCreateNamedSession,
  useGetOrCreateSession,
  useEndSession,
  useSessionHeartbeat,
  useDeleteSession,
  useUpdateSession,
  useCreateSubSession,
  useCaptureWaveform,
  useOpenOscilloscope,
  useCloseOscilloscope,
  useUpdateSessionDsp,
} from "./use-sessions";
export type { Session } from "./use-sessions";

export { useSessionSettings } from "./use-session-settings";
export { useLastUsedSession, useInitialSession } from "./use-last-used-session";

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
  useCreateRecording,
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

export { useMediaDevices } from "./use-media-devices";

export { useAudioAnalyzer } from "./use-audio-analyzer";
export type {
  AudioAnalyzerState,
  UseAudioAnalyzerOptions,
  UseAudioAnalyzerReturn,
  RecordingState,
} from "./use-audio-analyzer";

export { useWaveformGenerator } from "./use-waveform-generator";
export type { WaveformGeneratorSettings, UseWaveformGeneratorReturn } from "./use-waveform-generator";

export { useExport } from "./use-export";
export { useStreamingCSVExport, useRecordingExport } from "./use-streaming-csv-export";
export type { ExportProgress, ExportFormat } from "./use-streaming-csv-export";

export {
  formatBytes,
  formatDuration,
  formatDurationLong,
  formatTimestampRelative,
  formatSampleRate,
  formatFrequency,
  formatSampleCount,
  formatBitDepth,
  formatDCOffset,
  formatDecibel,
  formatDecibelRange,
  formatSessionDate,
  formatSessionTime,
} from "@audio-scope-view/api-client/domain/_shared/audio-utilities";

export { useAudioSettings } from "./use-audio-settings";

export { useIsMobile, useIsTablet } from "./use-mobile";

export { useTheme } from "./use-theme";

export { useUIStore } from "../store";
export type { UIStore, UIState, UIActions, WaveformColor, SessionMode } from "../store";
export { useAudioStore } from "../store";
export type { AudioStore, AudioState, AudioActions, SystemAudioInfo, MediaDevice } from "../store";
export { useWaveformStore } from "../store";
export type { WaveformMessage } from "../store";

export { useSessionDialogs } from "./use-session-dialogs";
export type { Recording } from "./use-session-dialogs";

export { useChunkedPlayback } from "./use-chunked-playback";
export type {
  ChunkedPlaybackState,
  ChunkedPlaybackOptions,
  ChunkedPlaybackReturn,
} from "./use-chunked-playback";

export { useStreamingPlayback } from "./use-streaming-playback";
export type {
  StreamingPlaybackState,
  StreamingPlaybackOptions,
  StreamingPlaybackReturn,
} from "./use-streaming-playback";

export { useScopeCapture } from "./use-scope-capture";
export type {
  DspMetrics as ScopeCaptureDspMetrics,
  DspMetrics,
  AnalysisUpdate,
  HarmonicComponent,
  UseScopeCaptureReturn,
} from "./use-scope-capture";

export { useAboutInfo, useFeatures, useChangelog } from "./use-about";
export type {
  AboutInfo,
  Feature,
  ChangelogChange,
  ChangelogRelease,
  FeaturesData,
  ChangelogData,
} from "./use-about";

export { useDeviceId } from "./use-device-id";

// Server-optional local mode (impl spec Step 8): on-device Room SQLite
// session store + sync to the deployed server when online.
export { useLocalSessions } from "./use-local-sessions";
export type { UseLocalSessionsReturn } from "./use-local-sessions";
export { useLocalSync } from "./use-local-sync";
export type { LocalSession, InsertSessionInput } from "../lib/local-store";
