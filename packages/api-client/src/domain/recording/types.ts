export interface Recording {
  id: string;
  scopeId: string;
  scopeName: string;
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
  scopeId: string;
  scopeName: string;
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
  scopeId?: string;
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

export type ScopeStatus = "live" | "paused" | "offline";

export interface ScopeWithStatus {
  id: string;
  name: string;
  description: string | undefined;
  status: ScopeStatus;
  sampleRate: number;
  bufferSize: number;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  recordingCount: number;
}

export interface ScopeListResult {
  scopes: ScopeWithStatus[];
  total: number;
  hasMore: boolean;
}

export interface CreateRecordingInput {
  scopeId: string;
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
  scope_id: string;
  scope_name: string;
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
  scope_id: string;
  scope_name: string;
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

export interface ScopeWithStatusServer {
  id: string;
  name: string;
  description: string | undefined;
  status: string;
  sample_rate: number;
  buffer_size: number;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  recording_count: number;
}

export interface ScopeListResultServer {
  scopes: ScopeWithStatusServer[];
  total: number;
  has_more: boolean;
}
