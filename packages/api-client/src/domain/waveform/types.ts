/**
 * Domain types for Waveform
 * These types are in camelCase (presentation format)
 */

// Domain type - camelCase presentation format
export interface Waveform {
  id: string;
  scopeId: string;
  samples: number[];
  sampleCount: number;
  timestamp: Date;
  durationMs: number;
  peakAmplitude: number;
  rmsAmplitude: number;
}

export interface WaveformSummary {
  id: string;
  scopeId: string;
  sampleCount: number;
  timestamp: Date;
  durationMs: number;
  peakAmplitude: number;
  rmsAmplitude: number;
}

export interface WaveformStatistics {
  totalCount: number;
  totalSamples: number;
  averagePeak: number;
  averageRms: number;
}

// Input type for creating waveform
export interface CreateWaveformInput {
  scopeId: string;
  samples: number[];
}

// Server response types (snake_case)
export interface WaveformServer {
  id: string;
  scope_id: string;
  samples: number[];
  sample_count: number;
  timestamp: string;
  duration_ms: number;
  peak_amplitude: number;
  rms_amplitude: number;
}

export interface WaveformSummaryServer {
  id: string;
  scope_id: string;
  sample_count: number;
  timestamp: string;
  duration_ms: number;
  peak_amplitude: number;
  rms_amplitude: number;
}

export interface WaveformStatisticsServer {
  total_count: number;
  total_samples: number;
  average_peak: number;
  average_rms: number;
}
