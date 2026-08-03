export interface Session {
  id: string;
  name?: string;
  description?: string;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  recordingCount: number;
  isOscilloscopeOpen: boolean;
  oscilloscopeDurationMs?: number;
  parentSessionId?: string;
  isSubSession: boolean;
  subSessionCount: number;
}

export interface CaptureSettingsInput {
  frequency?: number;
  amplitude?: number;
  noiseLevel?: number;
  durationMs?: number;
}

export interface CreateSessionInput {
  name?: string;
  description?: string;
}

export interface UpdateSessionInput {
  name?: string;
  description?: string;
}

export interface SessionServer {
  id: string;
  name?: string;
  description?: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  recordingCount: number;
  isOscilloscopeOpen: boolean;
  oscilloscopeDurationMs?: number;
  parentSessionId?: string;
  isSubSession: boolean;
  subSessionCount: number;
}
