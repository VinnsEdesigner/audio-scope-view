import type {
  DashboardSummary,
  DashboardSummaryServer,
  RecentSession,
  RecentSessionServer,
  TimeRange,
} from "./types";

export function recentSessionFromRaw(serverSession: RecentSessionServer): RecentSession {
  return {
    id: serverSession.id,
    startedAt: new Date(serverSession.started_at),
    recordingCount: serverSession.recording_count,
  };
}

export function dashboardSummaryFromRaw(serverSummary: DashboardSummaryServer): DashboardSummary {
  return {
    timeRange: serverSummary.time_range as TimeRange,
    generatedAt: new Date(serverSummary.generated_at),
    totalSessions: serverSummary.total_sessions,
    activeSessions: serverSummary.active_sessions,
    totalCaptures: serverSummary.total_captures,
    totalWaveforms: serverSummary.total_waveforms,
    totalSamples: serverSummary.total_samples,
    averagePeakAmplitude: serverSummary.average_peak_amplitude,
    averageRmsAmplitude: serverSummary.average_rms_amplitude,
    recentSessions: serverSummary.recent_sessions.map((s) => recentSessionFromRaw(s)),
  };
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function timeRangeToString(range: TimeRange): string {
  return range;
}
