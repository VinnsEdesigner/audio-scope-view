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
  startedAt: Date;
  endedAt: Date | null;
  status: SessionStatus;
  durationSeconds: number | null;
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
  session_id: string;
  session_name: string;
  name: string;
  samples: number[];
  timestamp: string;
  duration_ms: number;
  sample_count: number;
  size_bytes: number;
  peak_amplitude: number;
  rms_amplitude: number;
  is_pinned: boolean;
  is_recording: boolean;
}

export interface RecordingSummaryServer {
  id: string;
  session_id: string;
  session_name: string;
  name: string;
  timestamp: string;
  duration_ms: number;
  size_bytes: number;
  is_pinned: boolean;
}

export interface RecordingListResultServer {
  recordings: RecordingSummaryServer[];
  total: number;
  has_more: boolean;
}

export interface RecordingStatsServer {
  total_recordings: number;
  total_size_bytes: number;
  total_duration_ms: number;
  pinned_count: number;
}

export interface SessionWithStatusServer {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  duration_seconds: number | null;
  recording_count: number;
}

export interface SessionListResultServer {
  sessions: SessionWithStatusServer[];
  total: number;
  has_more: boolean;
}
