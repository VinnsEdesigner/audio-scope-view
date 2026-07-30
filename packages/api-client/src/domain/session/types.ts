export interface Session {
  id: string;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
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
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  recordingCount: number;
}
