export interface Session {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
  recordingCount: number;
}

export interface CaptureSettingsInput {
  frequency?: number;
  amplitude?: number;
  noiseLevel?: number;
  durationMs?: number;
}

export interface SessionServer {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_count: number;
}
