/**
 * Audio Analysis Utilities
 * Pure functions for audio signal processing and analysis
 */

export function normalizeAudioData(data: Uint8Array): Float32Array {
  const normalized = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    normalized[i] = (data[i] - 128) / 128;
  }
  return normalized;
}

export function calculateRMS(data: Float32Array): number {
  if (data.length === 0) return 0;

  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  return Math.sqrt(sum / data.length);
}

export function calculatePeak(data: Float32Array): number {
  if (data.length === 0) return 0;

  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const absValue = Math.abs(data[i]);
    if (absValue > peak) {
      peak = absValue;
    }
  }
  return peak;
}

export function downsampleWaveform(data: Float32Array, targetPoints: number): number[] {
  if (data.length === 0) return [];
  if (data.length <= targetPoints) {
    return Array.from(data);
  }

  const result: number[] = [];
  const step = data.length / targetPoints;

  for (let i = 0; i < targetPoints; i++) {
    const startIndex = Math.floor(i * step);
    const value = data[startIndex];
    result.push(value);
  }

  return result;
}

export function collectSamples(data: Uint8Array, interval: number): Float32Array {
  const samples: number[] = [];

  for (let i = 0; i < data.length; i += interval) {
    samples.push((data[i] - 128) / 128);
  }

  return new Float32Array(samples);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
