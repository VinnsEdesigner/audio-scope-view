import { config } from "../../config";

export const DEFAULT_CHUNK_SIZE = 100_000;

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

export class SampleChunkError extends Error {
  constructor(
    message: string,
    public readonly recordingId?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "SampleChunkError";
  }
}

export class SampleChunkService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? "";
  }

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
        response.status,
      );
    }

    const data = await response.json();
    return data as RecordingMetadata;
  }

  async getSamples(recordingId: string, start: number, end: number): Promise<SampleChunkResponse> {
    if (start >= end) {
      throw new SampleChunkError(
        `Invalid range: start (${start}) must be less than end (${end})`,
        recordingId,
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
        response.status,
      );
    }

    return response.json() as Promise<SampleChunkResponse>;
  }

  async *streamChunks(
    recordingId: string,
    chunkSize: number = DEFAULT_CHUNK_SIZE,
  ): AsyncGenerator<SampleChunkResponse> {
    const metadata = await this.getMetadata(recordingId);
    const totalSamples = metadata.sample_count;

    for (let start = 0; start < totalSamples; start += chunkSize) {
      const end = Math.min(start + chunkSize, totalSamples);
      const chunk = await this.getSamples(recordingId, start, end);
      yield chunk;
    }
  }

  async loadAllSamples(recordingId: string): Promise<Float32Array> {
    const metadata = await this.getMetadata(recordingId);
    const totalSamples = metadata.sample_count;
    const samples: number[] = [];

    for (let start = 0; start < totalSamples; start += MAX_CHUNK_SIZE) {
      const end = Math.min(start + MAX_CHUNK_SIZE, totalSamples);
      const chunk = await this.getSamples(recordingId, start, end);
      samples.push(...chunk.samples);
    }

    return new Float32Array(samples);
  }

  async loadSamplesForTimeRange(
    recordingId: string,
    startMs: number,
    endMs: number,
    sampleRate: number = 44_100,
  ): Promise<SampleChunkResponse> {
    const startSample = Math.floor((startMs / 1000) * sampleRate);
    const endSample = Math.ceil((endMs / 1000) * sampleRate);

    return this.getSamples(recordingId, startSample, endSample);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.bootstrapKey) {
      headers["Authorization"] = `Bearer ${config.bootstrapKey}`;
    }

    return headers;
  }
}

export const sampleChunkService = new SampleChunkService();
