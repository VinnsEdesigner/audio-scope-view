export interface Waveform {
  id: string;
  sessionId: string;
  samples: number[];
  sampleCount: number;
  timestamp: Date;
  durationMs: number;
  peakAmplitude: number;
  rmsAmplitude: number;
}

export interface WaveformSummary {
  id: string;
  sessionId: string;
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

export interface CreateWaveformInput {
  sessionId: string;
  samples: number[];
}

export interface WaveformServer {
  id: string;
  sessionId: string;
  samples: number[];
  sampleCount: number;
  timestamp: string;
  durationMs: number;
  peakAmplitude: number;
  rmsAmplitude: number;
}

export interface WaveformSummaryServer {
  id: string;
  sessionId: string;
  sampleCount: number;
  timestamp: string;
  durationMs: number;
  peakAmplitude: number;
  rmsAmplitude: number;
}

export interface WaveformStatisticsServer {
  totalCount: number;
  totalSamples: number;
  averagePeak: number;
  averageRms: number;
}
