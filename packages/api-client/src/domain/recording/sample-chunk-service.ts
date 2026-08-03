/**
 * Sample Chunk Service
 * 
 * Provides chunked loading of audio samples to avoid loading entire recordings at once.
 * This is essential for recordings with millions of samples (10MB+).
 * 
 * Usage:
 * ```typescript
 * const service = new SampleChunkService();
 * 
 * // Get metadata first
 * const meta = await service.getMetadata(recordingId);
 * 
 * // Load chunks as needed
 * const chunk1 = await service.getSamples(recordingId, 0, 100000);
 * const chunk2 = await service.getSamples(recordingId, 100000, 200000);
 * 
 * // Or use the helper for streaming chunks
 * for await (const chunk of service.streamChunks(recordingId, 100000)) {
 *   // Process chunk
 * }
 * ```
 */

import { config } from "../../config";

/** Default chunk size: 100,000 samples (~400KB) */
export const DEFAULT_CHUNK_SIZE = 100_000;

/** Maximum chunk size: 500,000 samples (~2MB) */
export const MAX_CHUNK_SIZE = 500_000;

export interface SampleChunkResponse {
  recording_id: string;
  start: number;
  end: number;
  total_samples: number;
  samples: number[];
}

export interface RecordingMetadata {
  id: string;
  name: string;
  sample_count: number;
  duration_ms: number;
  sample_rate: number;
}

/**
 * Custom error for sample chunk operations
 */
export class SampleChunkError extends Error {
  constructor(
    message: string,
    public readonly recordingId?: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "SampleChunkError";
  }
}

/**
 * Service for loading audio samples in chunks
 */
export class SampleChunkService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Use the same origin for REST API calls
    this.baseUrl = baseUrl ?? "";
  }

  /**
   * Get recording metadata (sample count, duration, etc.)
   * This is useful before starting chunked loading.
   */
  async getMetadata(recordingId: string): Promise<RecordingMetadata> {
    const url = `${this.baseUrl}/api/recordings/${encodeURIComponent(recordingId)}/metadata`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new SampleChunkError(`Recording not found: ${recordingId}`, recordingId, 404);
      }
      throw new SampleChunkError(
        `Failed to get metadata: ${response.statusText}`,
        recordingId,
        response.status
      );
    }

    const data = await response.json();
    return data as RecordingMetadata;
  }

  /**
   * Get a range of samples from a recording
   * 
   * @param recordingId - The recording ID
   * @param start - Start index (0-based, inclusive)
   * @param end - End index (exclusive)
   */
  async getSamples(
    recordingId: string,
    start: number,
    end: number
  ): Promise<SampleChunkResponse> {
    if (start >= end) {
      throw new SampleChunkError(
        `Invalid range: start (${start}) must be less than end (${end})`,
        recordingId
      );
    }

    const url = `${this.baseUrl}/api/recordings/${encodeURIComponent(recordingId)}/samples?start=${start}&end=${end}`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new SampleChunkError(`Recording not found: ${recordingId}`, recordingId, 404);
      }
      throw new SampleChunkError(
        `Failed to get samples: ${response.statusText}`,
        recordingId,
        response.status
      );
    }

    return response.json() as Promise<SampleChunkResponse>;
  }

  /**
   * Stream chunks from a recording, yielding chunks of the specified size
   * 
   * @param recordingId - The recording ID
   * @param chunkSize - Number of samples per chunk (default: DEFAULT_CHUNK_SIZE)
   */
  async *streamChunks(
    recordingId: string,
    chunkSize: number = DEFAULT_CHUNK_SIZE
  ): AsyncGenerator<SampleChunkResponse> {
    // Get metadata first
    const metadata = await this.getMetadata(recordingId);
    const totalSamples = metadata.sample_count;

    // Yield chunks until we've fetched everything
    for (let start = 0; start < totalSamples; start += chunkSize) {
      const end = Math.min(start + chunkSize, totalSamples);
      const chunk = await this.getSamples(recordingId, start, end);
      yield chunk;
    }
  }

  /**
   * Load all samples by fetching all chunks
   * Use this only when you need the entire recording.
   * For playback, prefer streamChunks() with AudioBuffer construction.
   */
  async loadAllSamples(recordingId: string): Promise<Float32Array> {
    const metadata = await this.getMetadata(recordingId);
    const totalSamples = metadata.sample_count;
    const samples: number[] = [];

    // Fetch in chunks
    for (let start = 0; start < totalSamples; start += MAX_CHUNK_SIZE) {
      const end = Math.min(start + MAX_CHUNK_SIZE, totalSamples);
      const chunk = await this.getSamples(recordingId, start, end);
      samples.push(...chunk.samples);
    }

    return new Float32Array(samples);
  }

  /**
   * Load samples for a specific time range
   * 
   * @param recordingId - The recording ID
   * @param startMs - Start time in milliseconds
   * @param endMs - End time in milliseconds
   * @param sampleRate - Sample rate (samples per second)
   */
  async loadSamplesForTimeRange(
    recordingId: string,
    startMs: number,
    endMs: number,
    sampleRate: number = 44100
  ): Promise<SampleChunkResponse> {
    const startSample = Math.floor((startMs / 1000) * sampleRate);
    const endSample = Math.ceil((endMs / 1000) * sampleRate);

    return this.getSamples(recordingId, startSample, endSample);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add auth header if configured
    if (config.bootstrapKey) {
      headers["Authorization"] = `Bearer ${config.bootstrapKey}`;
    }

    return headers;
  }
}

// Singleton instance for convenience
export const sampleChunkService = new SampleChunkService();
