/**
 * Type definitions for Audio Streaming Worklet
 */

export interface StreamingConfig {
  recordingId: string;
  sampleRate: number;
  totalSamples: number;
  chunkSize: number;
  baseUrl: string;
  authHeader?: string;
}

export interface ChunkRequest {
  type: 'request_chunk';
  startSample: number;
  endSample: number;
  priority: number;
}

export interface ChunkData {
  type: 'chunk_data';
  startSample: number;
  endSample: number;
  samples: Float32Array | number[];
}

export interface PlayCommand {
  type: 'play';
}

export interface PauseCommand {
  type: 'pause';
}

export interface StopCommand {
  type: 'stop';
}

export interface SeekCommand {
  type: 'seek';
  samplePosition: number;
}

export interface SetSpeedCommand {
  type: 'set_speed';
  speed: number;
}

export interface ConfigCommand {
  type: 'config';
  recordingId: string;
  sampleRate: number;
  totalSamples: number;
  chunkSize: number;
  baseUrl: string;
  authHeader?: string;
}

export interface PositionUpdate {
  type: 'position_update';
  currentSample: number;
}

export interface BufferStatus {
  type: 'buffer_status';
  bufferedChunks: number;
  currentSample: number;
}

export interface ReadyMessage {
  type: 'ready';
}

export interface EndedMessage {
  type: 'ended';
}

export type WorkerOutgoingMessage = ChunkRequest | PositionUpdate | BufferStatus | ReadyMessage | EndedMessage;

export type WorkerIncomingMessage = ChunkData | PlayCommand | PauseCommand | StopCommand | SeekCommand | SetSpeedCommand | ConfigCommand;
