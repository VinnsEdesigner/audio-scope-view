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
    name: serverSession.name,
    lastActivity: new Date(serverSession.lastActivity),
    waveformCount: serverSession.waveformCount,
  };
}

export function dashboardSummaryFromRaw(serverSummary: DashboardSummaryServer): DashboardSummary {
  return {
    timeRange: serverSummary.timeRange as TimeRange,
    generatedAt: new Date(serverSummary.generatedAt),
    totalSessions: serverSummary.totalSessions,
    activeSessions: serverSummary.activeSessions,
    totalCaptures: serverSummary.totalCaptures,
    totalWaveforms: serverSummary.totalWaveforms,
    totalSamples: serverSummary.totalSamples,
    averagePeakAmplitude: serverSummary.averagePeakAmplitude,
    averageRmsAmplitude: serverSummary.averageRmsAmplitude,
    recentSessions: serverSummary.recentSessions.map((s) => recentSessionFromRaw(s)),
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
