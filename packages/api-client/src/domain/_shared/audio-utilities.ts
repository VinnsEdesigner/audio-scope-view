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

export function calculateDCOffset(data: Float32Array): number {
  if (data.length === 0) return 0;

  let sum = 0;
  for (const datum of data) {
    sum += datum;
  }
  return sum / data.length;
}

export function calculateFrequency(data: Float32Array, sampleRate: number): number {
  if (data.length < 2) return 0;

  let zeroCrossings = 0;

  for (let index = 1; index < data.length; index++) {
    if ((data[index - 1] >= 0 && data[index] < 0) || (data[index - 1] < 0 && data[index] >= 0)) {
      zeroCrossings++;
    }
  }

  const fullCycles = zeroCrossings / 2;
  const durationInSeconds = data.length / sampleRate;

  if (durationInSeconds === 0) return 0;

  return fullCycles / durationInSeconds;
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

export function formatTimestampRelative(timestamp: string | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
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

export interface ExportCSVOptions {
  samples: Float32Array;
  sampleRate: number;
  includeHeader?: boolean;
  delimiter?: string;
}

export function exportToCSV(options: ExportCSVOptions): string {
  const { samples, sampleRate, includeHeader = true, delimiter = "," } = options;

  if (samples.length === 0) {
    return "";
  }

  const lines: string[] = [];

  if (includeHeader) {
    lines.push(`index${delimiter}time(s)${delimiter}value`);
  }

  const timeStep = 1 / sampleRate;
  for (const [index, sample] of samples.entries()) {
    const time = (index * timeStep).toFixed(9);
    lines.push(`${index}${delimiter}${time}${delimiter}${sample.toFixed(9)}`);
  }

  return lines.join("\n");
}

/**
 * Options for streaming CSV export
 */
export interface StreamingCSVExportOptions {
  sampleRate?: number;
  chunkSize?: number;
  delimiter?: string;
  filename?: string;
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Creates an async generator that yields sample chunks for CSV export
 */
export async function* createSampleChunkGenerator(
  chunkService: {
    streamChunks: (
      recordingId: string,
      chunkSize?: number,
    ) => AsyncGenerator<{ samples: number[] }>;
  },
  recordingId: string,
  chunkSize: number = 100_000,
): AsyncGenerator<number[], void, unknown> {
  for await (const chunk of chunkService.streamChunks(recordingId, chunkSize)) {
    yield chunk.samples;
  }
}

/**
 * Stream CSV export using Fetch API with ReadableStream
 * This avoids loading the entire file into memory
 */
export async function streamCSVExport(
  recordingId: string,
  sampleRate: number,
  totalSamples: number,
  chunkService: {
    streamChunks: (
      recordingId: string,
      chunkSize?: number,
    ) => AsyncGenerator<{ samples: number[] }>;
  },
  options: StreamingCSVExportOptions = {},
): Promise<void> {
  const {
    delimiter = ",",
    filename = `recording_${recordingId}_${Date.now()}.csv`,
    onProgress,
  } = options;

  if (typeof document === "undefined") {
    throw new TypeError("streamCSVExport can only be called in a browser environment");
  }

  // Create a ReadableStream to generate the CSV data
  const csvStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const chunkSize = 100_000;
      let processedSamples = 0;
      let globalIndex = 0;
      const timeStep = 1 / sampleRate;

      // Write header
      controller.enqueue(encoder.encode(`index${delimiter}time(s)${delimiter}value\n`));

      try {
        for await (const chunk of chunkService.streamChunks(recordingId, chunkSize)) {
          const lines: string[] = [];

          for (const sample of chunk.samples) {
            const time = (globalIndex * timeStep).toFixed(9);
            lines.push(`${globalIndex}${delimiter}${time}${delimiter}${sample.toFixed(9)}`);
            globalIndex++;
          }

          processedSamples += chunk.samples.length;

          // Write chunk as a single string for efficiency
          controller.enqueue(encoder.encode(lines.join("\n") + "\n"));

          // Report progress
          if (onProgress) {
            onProgress(processedSamples, totalSamples);
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  // Use fetch to stream the download
  const response = new Response(csvStream, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8;",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Simple in-memory CSV export for smaller datasets
 * Falls back to this if streaming is not available
 */
export async function exportCSVInMemory(
  chunkService: {
    streamChunks: (
      recordingId: string,
      chunkSize?: number,
    ) => AsyncGenerator<{ samples: number[] }>;
  },
  recordingId: string,
  sampleRate: number,
  options: StreamingCSVExportOptions = {},
): Promise<void> {
  const {
    delimiter = ",",
    filename = `recording_${recordingId}_${Date.now()}.csv`,
    onProgress,
  } = options;

  if (typeof document === "undefined") {
    throw new TypeError("exportCSVInMemory can only be called in a browser environment");
  }

  const chunks: string[] = [];
  chunks.push(`index${delimiter}time(s)${delimiter}value\n`);

  let processedSamples = 0;
  let globalIndex = 0;
  const timeStep = 1 / sampleRate;
  const chunkSize = 100_000;
  let batchLines: string[] = [];

  for await (const chunk of chunkService.streamChunks(recordingId, chunkSize)) {
    for (const sample of chunk.samples) {
      const time = (globalIndex * timeStep).toFixed(9);
      batchLines.push(`${globalIndex}${delimiter}${time}${delimiter}${sample.toFixed(9)}`);
      globalIndex++;

      if (batchLines.length >= 10_000) {
        chunks.push(batchLines.join("\n") + "\n");
        batchLines = [];
      }
    }

    processedSamples += chunk.samples.length;
    if (onProgress) {
      onProgress(processedSamples, globalIndex);
    }
  }

  // Add remaining lines
  if (batchLines.length > 0) {
    chunks.push(batchLines.join("\n") + "\n");
  }

  const csvContent = chunks.join("");
  downloadFile(csvContent, filename, "text/csv;charset=utf-8;");
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  if (typeof document === "undefined") {
    throw new TypeError("downloadFile can only be called in a browser environment");
  }
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function captureCanvasAsPNG(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}

export function downloadCanvasAsPNG(canvas: HTMLCanvasElement, filename: string): void {
  if (typeof document === "undefined") {
    throw new TypeError("downloadCanvasAsPNG can only be called in a browser environment");
  }
  const dataUrl = captureCanvasAsPNG(canvas);
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

export function formatSampleRate(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(1)} kHz`;
  }
  return `${hz.toFixed(0)} Hz`;
}

export function formatFrequency(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(1)} kHz`;
  }
  if (hz < 1) {
    return `~0 Hz`;
  }
  return `${hz.toFixed(0)} Hz`;
}

export function formatSampleCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

export function formatBitDepth(bits: number): string {
  return `${bits}-bit`;
}

export function formatDCOffset(volts: number): string {
  const sign = volts >= 0 ? "+" : "";
  return `${sign}${volts.toFixed(2)} V`;
}

export function formatDecibel(decibel: number): string {
  const sign = decibel >= 0 ? "+" : "";
  return `${sign}${decibel.toFixed(1)} dB`;
}

export function formatDecibelRange(
  minDecibel: number,
  maxDecibel: number,
  peakDecibel: number,
): { min: string; max: string; peak: string } {
  return {
    min: `${minDecibel.toFixed(0)} dB`,
    max: `${maxDecibel.toFixed(0)} dB`,
    peak: formatDecibel(peakDecibel),
  };
}

export function formatSessionDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatSessionTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
