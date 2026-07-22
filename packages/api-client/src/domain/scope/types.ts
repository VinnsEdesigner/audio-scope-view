/**
 * Domain types for Scope
 * These types are in camelCase (presentation format)
 * They represent what the UI layer receives
 */

// Domain type - camelCase presentation format
export interface Scope {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sampleRate: number;
  bufferSize: number;
  createdAt: Date;
  updatedAt: Date;
}

// Input types for creating/updating - camelCase
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

// Capture settings for audio capture
export interface CaptureSettingsInput {
  frequency?: number;
  amplitude?: number;
  noiseLevel?: number;
  durationMs?: number;
}

// Server response type (snake_case) - used by transforms
export interface ScopeServer {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sample_rate: number;
  buffer_size: number;
  created_at: string;
  updated_at: string;
}
