export interface Recording {
  id: string;
  sessionId: string;
  sessionName: string;
  name: string;
  samples: number[];
  timestamp: Date;
  durationMs: number;
  sampleCount: number;
  sizeBytes: number;
  peakAmplitude: number;
  rmsAmplitude: number;
  isPinned: boolean;
  isRecording: boolean;
  /** Downsampled waveform overview for fast display (min-max pairs) */
  waveformOverview: number[];
}

/**
 * Recording preview type - used for fast loading without samples.
 * Use this for display purposes only. For playback, use chunked loading.
 */
export interface RecordingPreview {
  id: string;
  sessionId: string;
  sessionName: string;
  name: string;
  timestamp: Date;
  durationMs: number;
  sampleCount: number;
  sizeBytes: number;
  peakAmplitude: number;
  rmsAmplitude: number;
  isPinned: boolean;
  isRecording: boolean;
  /** Downsampled waveform overview for fast display (min-max pairs) */
  waveformOverview: number[];
}

export interface RecordingSummary {
  id: string;
  sessionId: string;
  sessionName: string;
  name: string;
  timestamp: Date;
  durationMs: number;
  sizeBytes: number;
  isPinned: boolean;
}

export interface RecordingListParameters {
  timeRange?: TimeRange;
  limit?: number;
  offset?: number;
  sessionId?: string;
  pinnedOnly?: boolean;
}

export interface RecordingListResult {
  recordings: RecordingSummary[];
  total: number;
  hasMore: boolean;
}

export interface RecordingStats {
  totalRecordings: number;
  totalSizeBytes: number;
  totalDurationMs: number;
  pinnedCount: number;
}

export type SessionStatus = "live" | "paused" | "offline";

export interface SessionWithStatus {
  id: string;
  name: string;
  startedAt: Date;
  endedAt?: Date;
  status: SessionStatus;
  durationSeconds?: number;
  recordingCount: number;
}

export interface SessionListResult {
  sessions: SessionWithStatus[];
  total: number;
  hasMore: boolean;
}

export interface CreateRecordingInput {
  sessionId: string;
  name?: string;
}

export interface UpdateRecordingInput {
  id: string;
  name?: string;
  isPinned?: boolean;
}

export interface DeleteRecordingInput {
  id: string;
}

export type TimeRange = "last_hour" | "last_24_hours" | "last_7_days" | "last_30_days";

export interface RecordingServer {
  id: string;
  sessionId: string;
  sessionName: string;
  name: string;
  samples: number[];
  timestamp: string;
  durationMs: number;
  sampleCount: number;
  sizeBytes: number;
  peakAmplitude: number;
  rmsAmplitude: number;
  isPinned: boolean;
  isRecording: boolean;
  /** Downsampled waveform overview for fast display (min-max pairs) */
  waveformOverview: number[];
}

/**
 * Server response for recording preview (without samples).
 * This is returned by the recordingPreview GraphQL query.
 */
export interface RecordingPreviewServer {
  id: string;
  sessionId: string;
  sessionName: string;
  name: string;
  timestamp: string;
  durationMs: number;
  sampleCount: number;
  sizeBytes: number;
  peakAmplitude: number;
  rmsAmplitude: number;
  isPinned: boolean;
  isRecording: boolean;
  /** Downsampled waveform overview for fast display (min-max pairs) */
  waveformOverview: number[];
}

export interface RecordingSummaryServer {
  id: string;
  sessionId: string;
  sessionName: string;
  name: string;
  timestamp: string;
  durationMs: number;
  sizeBytes: number;
  isPinned: boolean;
}

export interface RecordingListResultServer {
  recordings: RecordingSummaryServer[];
  total: number;
  hasMore: boolean;
}

export interface RecordingStatsServer {
  totalRecordings: number;
  totalSizeBytes: number;
  totalDurationMs: number;
  pinnedCount: number;
}

export interface SessionWithStatusServer {
  id: string;
  name: string;
  createdAt: string;
  status: string;
  recordingCount: number;
}

export interface SessionListResultServer {
  sessions: SessionWithStatusServer[];
  total: number;
  hasMore: boolean;
}
