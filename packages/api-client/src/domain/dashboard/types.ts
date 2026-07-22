/**
 * Domain types for Dashboard
 * These types are in camelCase (presentation format)
 */

export interface RecentScope {
  id: string;
  name: string;
  lastActivity: Date;
  waveformCount: number;
}

export interface DashboardSummary {
  timeRange: TimeRange;
  generatedAt: Date;
  totalScopes: number;
  activeScopes: number;
  totalCaptures: number;
  totalWaveforms: number;
  totalSamples: number;
  averagePeakAmplitude: number;
  averageRmsAmplitude: number;
  recentScopes: RecentScope[];
}

export type TimeRange = "last_hour" | "last_24_hours" | "last_7_days" | "last_30_days";

// Server response types (snake_case)
export interface RecentScopeServer {
  id: string;
  name: string;
  last_activity: string;
  waveform_count: number;
}

export interface DashboardSummaryServer {
  time_range: string;
  generated_at: string;
  total_scopes: number;
  active_scopes: number;
  total_captures: number;
  total_waveforms: number;
  total_samples: number;
  average_peak_amplitude: number;
  average_rms_amplitude: number;
  recent_scopes: RecentScopeServer[];
}
