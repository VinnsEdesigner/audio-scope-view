import type {
  Recording,
  RecordingSummary,
  RecordingListResult,
  RecordingStats,
  SessionWithStatus,
  SessionListResult,
  RecordingServer,
  RecordingSummaryServer,
  RecordingListResultServer,
  RecordingStatsServer,
  SessionWithStatusServer,
  SessionListResultServer,
} from "./types";

export function transformRecording(server: RecordingServer): Recording {
  return {
    id: server.id,
    sessionId: server.session_id,
    sessionName: server.session_name,
    name: server.name,
    samples: server.samples,
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
    sessionId: server.session_id,
    sessionName: server.session_name,
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

export function transformSessionWithStatus(server: SessionWithStatusServer): SessionWithStatus {
  return {
    id: server.id,
    startedAt: new Date(server.started_at),
    endedAt: server.ended_at ? new Date(server.ended_at) : null,
    status: server.status as "live" | "paused" | "offline",
    durationSeconds: server.duration_seconds,
    recordingCount: server.recording_count,
  };
}

export function transformSessionListResult(server: SessionListResultServer): SessionListResult {
  return {
    sessions: server.sessions.map((s) => transformSessionWithStatus(s)),
    total: server.total,
    hasMore: server.has_more,
  };
}

export function transformRecordingToServer(recording: Partial<Recording>): Record<string, unknown> {
  return {
    ...(recording.id && { id: recording.id }),
    ...(recording.sessionId && { session_id: recording.sessionId }),
    ...(recording.name && { name: recording.name }),
    ...(recording.isPinned !== undefined && { is_pinned: recording.isPinned }),
  };
}
