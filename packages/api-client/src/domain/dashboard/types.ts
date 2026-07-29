export interface RecentSession {
  id: string;
  startedAt: Date;
  recordingCount: number;
}

export interface DashboardSummary {
  timeRange: TimeRange;
  generatedAt: Date;
  totalSessions: number;
  activeSessions: number;
  totalCaptures: number;
  totalWaveforms: number;
  totalSamples: number;
  averagePeakAmplitude: number;
  averageRmsAmplitude: number;
  recentSessions: RecentSession[];
}

export type TimeRange = "last_hour" | "last_24_hours" | "last_7_days" | "last_30_days";

export interface RecentSessionServer {
  id: string;
  started_at: string;
  recording_count: number;
}

export interface DashboardSummaryServer {
  time_range: string;
  generated_at: string;
  total_sessions: number;
  active_sessions: number;
  total_captures: number;
  total_waveforms: number;
  total_samples: number;
  average_peak_amplitude: number;
  average_rms_amplitude: number;
  recent_sessions: RecentSessionServer[];
}
