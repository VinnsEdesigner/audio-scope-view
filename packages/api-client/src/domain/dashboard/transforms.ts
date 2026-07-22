import type {
  DashboardSummary,
  DashboardSummaryServer,
  RecentScope,
  RecentScopeServer,
  TimeRange,
} from "./types";

/**
 * Transform server response (snake_case) to domain type (camelCase)
 */
export function recentScopeFromRaw(serverScope: RecentScopeServer): RecentScope {
  return {
    id: serverScope.id,
    name: serverScope.name,
    lastActivity: new Date(serverScope.last_activity),
    waveformCount: serverScope.waveform_count,
  };
}

export function dashboardSummaryFromRaw(serverSummary: DashboardSummaryServer): DashboardSummary {
  return {
    timeRange: serverSummary.time_range as TimeRange,
    generatedAt: new Date(serverSummary.generated_at),
    totalScopes: serverSummary.total_scopes,
    activeScopes: serverSummary.active_scopes,
    totalCaptures: serverSummary.total_captures,
    totalWaveforms: serverSummary.total_waveforms,
    totalSamples: serverSummary.total_samples,
    averagePeakAmplitude: serverSummary.average_peak_amplitude,
    averageRmsAmplitude: serverSummary.average_rms_amplitude,
    recentScopes: serverSummary.recent_scopes.map((s) => recentScopeFromRaw(s)),
  };
}

/**
 * Format timestamp for display
 */
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

/**
 * Get time range string for query
 */
export function timeRangeToString(range: TimeRange): string {
  return range;
}
