export interface Scope {
  id: string;
  name: string;
  description: string | undefined;
  isActive: boolean;
  sampleRate: number;
  bufferSize: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScopeInput {
  name: string;
  description?: string;
  sampleRate?: number;
  bufferSize?: number;
}

export interface UpdateScopeInput {
  name?: string;
  description?: string;
  sampleRate?: number;
  bufferSize?: number;
  isActive?: boolean;
}

export interface CaptureSettingsInput {
  frequency?: number;
  amplitude?: number;
  noiseLevel?: number;
  durationMs?: number;
}

export interface ScopeServer {
  id: string;
  name: string;
  description: string | undefined;
  is_active: boolean;
  sample_rate: number;
  buffer_size: number;
  created_at: string;
  updated_at: string;
}
