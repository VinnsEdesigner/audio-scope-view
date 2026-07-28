export function normalizeAudioData(data: Uint8Array): Float32Array {
  const normalized = new Float32Array(data.length);
  for (const [index, datum] of data.entries()) {
    normalized[index] = (datum - 128) / 128;
  }
  return normalized;
}

export function calculateRMS(data: Float32Array): number {
  if (data.length === 0) return 0;

  let sum = 0;
  for (const datum of data) {
    sum += datum * datum;
  }
  return Math.sqrt(sum / data.length);
}

export function calculatePeak(data: Float32Array): number {
  if (data.length === 0) return 0;

  let peak = 0;
  for (const datum of data) {
    const absValue = Math.abs(datum);
    if (absValue > peak) {
      peak = absValue;
    }
  }
  return peak;
}

export function downsampleWaveform(data: Float32Array, targetPoints: number): number[] {
  if (data.length === 0) return [];
  if (data.length <= targetPoints) {
    return [...data];
  }

  const result: number[] = [];
  const step = data.length / targetPoints;

  for (let index = 0; index < targetPoints; index++) {
    const startIndex = Math.floor(index * step);
    const value = data[startIndex];
    result.push(value);
  }

  return result;
}

export function collectSamples(data: Uint8Array, interval: number): Float32Array {
  const samples: number[] = [];

  for (let index = 0; index < data.length; index += interval) {
    samples.push((data[index] - 128) / 128);
  }

  return new Float32Array(samples);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(k));
  return Number.parseFloat((bytes / Math.pow(k, index)).toFixed(1)) + " " + sizes[index];
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function formatDurationLong(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

export function formatTimestampRelative(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
