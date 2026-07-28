import type {
  Recording,
  RecordingSummary,
  RecordingListResult,
  RecordingStats,
  ScopeWithStatus,
  ScopeListResult,
  RecordingServer,
  RecordingSummaryServer,
  RecordingListResultServer,
  RecordingStatsServer,
  ScopeWithStatusServer,
  ScopeListResultServer,
} from "./types";

export function transformRecording(server: RecordingServer): Recording {
  return {
    id: server.id,
    scopeId: server.scope_id,
    scopeName: server.scope_name,
    name: server.name,
    timestamp: new Date(server.timestamp),
    durationMs: server.duration_ms,
    sampleCount: server.sample_count,
    sizeBytes: server.size_bytes,
    peakAmplitude: server.peak_amplitude,
    rmsAmplitude: server.rms_amplitude,
    isPinned: server.is_pinned,
    isRecording: server.is_recording,
  };
}

export function transformRecordingSummary(server: RecordingSummaryServer): RecordingSummary {
  return {
    id: server.id,
    scopeId: server.scope_id,
    scopeName: server.scope_name,
    name: server.name,
    timestamp: new Date(server.timestamp),
    durationMs: server.duration_ms,
    sizeBytes: server.size_bytes,
    isPinned: server.is_pinned,
  };
}

export function transformRecordingListResult(
  server: RecordingListResultServer,
): RecordingListResult {
  return {
    recordings: server.recordings.map((s) => transformRecordingSummary(s)),
    total: server.total,
    hasMore: server.has_more,
  };
}

export function transformRecordingStats(server: RecordingStatsServer): RecordingStats {
  return {
    totalRecordings: server.total_recordings,
    totalSizeBytes: server.total_size_bytes,
    totalDurationMs: server.total_duration_ms,
    pinnedCount: server.pinned_count,
  };
}

export function transformScopeWithStatus(server: ScopeWithStatusServer): ScopeWithStatus {
  return {
    id: server.id,
    name: server.name,
    description: server.description,
    status: server.status as "live" | "paused" | "offline",
    sampleRate: server.sample_rate,
    bufferSize: server.buffer_size,
    createdAt: new Date(server.created_at),
    updatedAt: new Date(server.updated_at),
    lastActivityAt: new Date(server.last_activity_at),
    recordingCount: server.recording_count,
  };
}

export function transformScopeListResult(server: ScopeListResultServer): ScopeListResult {
  return {
    scopes: server.scopes.map((s) => transformScopeWithStatus(s)),
    total: server.total,
    hasMore: server.has_more,
  };
}

export function transformRecordingToServer(recording: Partial<Recording>): Record<string, unknown> {
  return {
    ...(recording.id && { id: recording.id }),
    ...(recording.scopeId && { scope_id: recording.scopeId }),
    ...(recording.name && { name: recording.name }),
    ...(recording.isPinned !== undefined && { is_pinned: recording.isPinned }),
  };
}
