export interface RecentSession {
  id: string;
  name: string;
  lastActivity: Date;
  waveformCount: number;
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
  name: string;
  lastActivity: string;
  waveformCount: number;
}

export interface DashboardSummaryServer {
  timeRange: string;
  generatedAt: string;
  totalSessions: number;
  activeSessions: number;
  totalCaptures: number;
  totalWaveforms: number;
  totalSamples: number;
  averagePeakAmplitude: number;
  averageRmsAmplitude: number;
  recentSessions: RecentSessionServer[];
}
