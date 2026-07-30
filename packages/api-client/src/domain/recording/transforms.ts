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
    sessionId: server.sessionId,
    sessionName: server.sessionName,
    name: server.name,
    samples: server.samples,
    timestamp: new Date(server.timestamp),
    durationMs: server.durationMs,
    sampleCount: server.sampleCount,
    sizeBytes: server.sizeBytes,
    peakAmplitude: server.peakAmplitude,
    rmsAmplitude: server.rmsAmplitude,
    isPinned: server.isPinned,
    isRecording: server.isRecording,
  };
}

export function transformRecordingSummary(server: RecordingSummaryServer): RecordingSummary {
  return {
    id: server.id,
    sessionId: server.sessionId,
    sessionName: server.sessionName,
    name: server.name,
    timestamp: new Date(server.timestamp),
    durationMs: server.durationMs,
    sizeBytes: server.sizeBytes,
    isPinned: server.isPinned,
  };
}

export function transformRecordingListResult(
  server: RecordingListResultServer,
): RecordingListResult {
  return {
    recordings: server.recordings.map((s) => transformRecordingSummary(s)),
    total: server.total,
    hasMore: server.hasMore,
  };
}

export function transformRecordingStats(server: RecordingStatsServer): RecordingStats {
  return {
    totalRecordings: server.totalRecordings,
    totalSizeBytes: server.totalSizeBytes,
    totalDurationMs: server.totalDurationMs,
    pinnedCount: server.pinnedCount,
  };
}

export function transformSessionWithStatus(server: SessionWithStatusServer): SessionWithStatus {
  return {
    id: server.id,
    name: server.name,
    startedAt: new Date(server.createdAt),
    endedAt: undefined,
    status: server.status as "live" | "paused" | "offline",
    durationSeconds: undefined,
    recordingCount: server.recordingCount,
  };
}

export function transformSessionListResult(server: SessionListResultServer): SessionListResult {
  return {
    sessions: server.sessions.map((s) => transformSessionWithStatus(s)),
    total: server.total,
    hasMore: server.hasMore,
  };
}

export function transformRecordingToServer(recording: Partial<Recording>): Record<string, unknown> {
  return {
    ...(recording.id && { id: recording.id }),
    ...(recording.sessionId && { sessionId: recording.sessionId }),
    ...(recording.name && { name: recording.name }),
    ...(recording.isPinned !== undefined && { isPinned: recording.isPinned }),
  };
}
