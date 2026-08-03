/**
 * use-streaming-playback Hook
 *
 * Provides true streaming audio playback using AudioWorklet.
 * This enables playback of large recordings (51MB+) without
 * buffering the entire file first.
 *
 * Features:
 * - True streaming with on-demand chunk fetching
 * - No full buffer required - plays as chunks arrive
 * - Seamless playback with automatic chunk preloading
 * - Configurable chunk size and buffering
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "@audio-scope-view/api-client/config";

/** Streaming playback state */
export interface StreamingPlaybackState {
  isLoading: boolean;
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number; // in milliseconds
  duration: number; // in milliseconds
  currentSample: number;
  totalSamples: number;
  bufferedChunks: number;
  error: Error | undefined;
  isBuffering: boolean; // true when waiting for chunks
}

/** Hook options */
export interface StreamingPlaybackOptions {
  /** Recording ID to play */
  recordingId: string;
  /** Chunk size in samples (default: 44100 = ~1 second at 44.1kHz) */
  chunkSize?: number;
  /** Playback speed (1 = normal) */
  playbackSpeed?: number;
  /** Auto-start playback */
  autoPlay?: boolean;
  /** Callback when playback ends */
  onEnded?: () => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

/** Hook return type */
export interface StreamingPlaybackReturn {
  state: StreamingPlaybackState;
  // Playback controls
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeMs: number) => void;
  setSpeed: (speed: number) => void;
  // Utilities
  getCurrentSampleIndex: () => number;
  getCurrentTimeMs: () => number;
}

const WORKLET_PROCESSOR_NAME = "audio-streaming-processor";

/**
 * Hook for streaming audio playback using AudioWorklet
 *
 * This hook manages:
 * - AudioContext and AudioWorkletNode
 * - Chunk fetching from server
 * - Playback state and position tracking
 *
 * Usage:
 * ```tsx
 * const { state, play, pause, seek } = useStreamingPlayback({
 *   recordingId: "recording-123",
 *   chunkSize: 44100, // ~1 second per chunk
 * });
 *
 * return (
 *   <div>
 *     <button onClick={play}>Play</button>
 *     <button onClick={pause}>Pause</button>
 *     <span>{state.currentTime.toFixed(1)}s / {state.duration.toFixed(1)}s</span>
 *   </div>
 * );
 * ```
 */
export function useStreamingPlayback(options: StreamingPlaybackOptions): StreamingPlaybackReturn {
  const {
    recordingId,
    chunkSize = 44_100, // ~1 second of audio at 44.1kHz
    playbackSpeed = 1,
    autoPlay = false,
    onEnded,
    onError,
  } = options;

  // State
  const [state, setState] = useState<StreamingPlaybackState>({
    isLoading: true,
    isPlaying: false,
    isReady: false,
    currentTime: 0,
    duration: 0,
    currentSample: 0,
    totalSamples: 0,
    bufferedChunks: 0,
    error: undefined,
    isBuffering: true,
  });

  // Refs
  const audioContextReference = useRef<AudioContext | null>(null);
  const workletNodeReference = useRef<AudioWorkletNode | null>(null);
  const workletLoadedReference = useRef(false);
  const playbackSpeedReference = useRef(playbackSpeed);
  const isPlayingReference = useRef(false);

  // Fetch state
  const totalSamplesReference = useRef(0);
  const sampleRateReference = useRef(44_100);
  const currentSampleReference = useRef(0);
  const pendingFetchesReference = useRef<Map<number, AbortController>>(new Map());

  // Load metadata
  useEffect(() => {
    let cancelled = false;

    async function loadMetadata() {
      setState((s) => ({ ...s, isLoading: true, error: undefined }));

      try {
        const response = await fetch(
          `${config.graphqlEndpoint.replace("/graphql", "")}/api/recordings/${encodeURIComponent(recordingId)}/metadata`,
          {
            headers: config.bootstrapKey ? { Authorization: `Bearer ${config.bootstrapKey}` } : {},
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to load metadata: ${response.statusText}`);
        }

        const metadata = await response.json();

        if (cancelled) return;

        totalSamplesReference.current = metadata.sample_count;
        sampleRateReference.current = metadata.sample_rate || 44_100;

        const durationMs = metadata.duration_ms;

        setState((s) => ({
          ...s,
          isLoading: false,
          duration: durationMs,
          totalSamples: metadata.sample_count,
        }));
      } catch (error) {
        if (!cancelled) {
          const error_ = error instanceof Error ? error : new Error(String(error));
          setState((s) => ({ ...s, isLoading: false, error: error_ }));
          onError?.(error_);
        }
      }
    }

    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [recordingId, onError]);

  // Initialize AudioContext and Worklet
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function initAudio() {
      try {
        // Create AudioContext
        const context = new AudioContext({ sampleRate: sampleRateReference.current });
        audioContextReference.current = context;

        // Load AudioWorklet processor from public directory
        // Using fetch to get the worklet from public directory
        const workletPath = "/audio/worklets/audio-streaming-processor.js";

        // First, we'll try to load from public directory
        // The worklet must be served as a static file
        try {
          await context.audioWorklet.addModule(workletPath);
        } catch {
          // Fallback: inline worklet code as blob URL
          console.warn("Failed to load worklet from public, using inline fallback");
          const workletResponse = await fetch(workletPath);
          const workletCode = await workletResponse.text();
          const blob = new Blob([workletCode], { type: "application/javascript" });
          const blobUrl = URL.createObjectURL(blob);
          await context.audioWorklet.addModule(blobUrl);
          URL.revokeObjectURL(blobUrl);
        }
        workletLoadedReference.current = true;

        // Create AudioWorkletNode
        const workletNode = new AudioWorkletNode(context, WORKLET_PROCESSOR_NAME, {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });
        workletNodeReference.current = workletNode;

        // Connect to destination
        workletNode.connect(context.destination);

        // Handle messages from worklet
        // Using addEventListener for proper Web Audio API port handling
        workletNode.port.addEventListener("message", (event: MessageEvent) => {
          handleWorkletMessage(event.data);
        });

        // Configure the worklet
        workletNode.port.postMessage({
          type: "config",
          recordingId,
          sampleRate: sampleRateReference.current,
          totalSamples: totalSamplesReference.current,
          chunkSize,
          baseUrl: config.graphqlEndpoint.replace("/graphql", ""),
          authHeader: config.bootstrapKey ? `Bearer ${config.bootstrapKey}` : undefined,
        });

        setState((s) => ({ ...s, isReady: true }));

        // Auto-play if requested
        if (autoPlay) {
          play();
        }

        cleanup = () => {
          workletNode.disconnect();
          workletNode.port.close();
          context.close();
        };
      } catch (error) {
        const error_ = error instanceof Error ? error : new Error(String(error));
        setState((s) => ({ ...s, error: error_ }));
        onError?.(error_);
      }
    }

    initAudio();

    return () => {
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingId, chunkSize, autoPlay, onError]);

  // Handle messages from worklet
  const handleWorkletMessage = useCallback(
    (message: { type: string; [key: string]: unknown }) => {
      switch (message.type) {
        case "ready": {
          // Worklet is ready
          break;
        }

        case "request_chunk": {
          // Worklet requesting a chunk - fetch it from server
          fetchChunk(message.startSample as number, message.endSample as number);
          break;
        }

        case "position_update": {
          currentSampleReference.current = message.currentSample as number;
          setState((s) => ({
            ...s,
            currentSample: message.currentSample as number,
            currentTime: ((message.currentSample as number) / sampleRateReference.current) * 1000,
          }));
          break;
        }

        case "buffer_status": {
          setState((s) => ({
            ...s,
            bufferedChunks: message.bufferedChunks as number,
            isBuffering: (message.bufferedChunks as number) < 2,
          }));
          break;
        }

        case "ended": {
          isPlayingReference.current = false;
          setState((s) => ({ ...s, isPlaying: false }));
          onEnded?.();
          break;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onEnded],
  );

  // Fetch a chunk from the server
  const fetchChunk = useCallback(
    async (startSample: number, endSample: number) => {
      const baseUrl = config.graphqlEndpoint.replace("/graphql", "");

      // Check if we already have a pending fetch for this chunk
      if (pendingFetchesReference.current.has(startSample)) {
        return;
      }

      // Create abort controller
      const abortController = new AbortController();
      pendingFetchesReference.current.set(startSample, abortController);

      try {
        const response = await fetch(
          `${baseUrl}/api/recordings/${encodeURIComponent(recordingId)}/stream?start=${startSample}&end=${endSample}`,
          {
            headers: config.bootstrapKey ? { Authorization: `Bearer ${config.bootstrapKey}` } : {},
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch chunk: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();

        // Convert bytes to Float32Array
        const samples = new Float32Array(buffer.byteLength / 4);
        const view = new DataView(buffer);
        for (let index = 0; index < samples.length; index++) {
          samples[index] = view.getFloat32(index * 4, true); // little-endian
        }

        // Send to worklet
        if (workletNodeReference.current) {
          workletNodeReference.current.port.postMessage(
            {
              type: "chunk_data",
              startSample,
              endSample,
              samples,
            },
            [samples.buffer], // Transfer ownership for efficiency
          );
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to fetch chunk:", error);
        }
      } finally {
        pendingFetchesReference.current.delete(startSample);
      }
    },
    [recordingId],
  );

  // Play
  const play = useCallback(async () => {
    if (!workletNodeReference.current || !audioContextReference.current) return;

    // Resume context if suspended
    const context = audioContextReference.current;
    if (context.state === "suspended") {
      await context.resume();
    }

    isPlayingReference.current = true;
    workletNodeReference.current.port.postMessage({ type: "play" });
    setState((s) => ({ ...s, isPlaying: true }));
  }, []);

  // Pause
  const pause = useCallback(() => {
    if (!workletNodeReference.current) return;

    isPlayingReference.current = false;
    workletNodeReference.current.port.postMessage({ type: "pause" });
    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  // Stop
  const stop = useCallback(() => {
    if (!workletNodeReference.current) return;

    // Cancel pending fetches
    for (const controller of pendingFetchesReference.current.values()) {
      controller.abort();
    }
    pendingFetchesReference.current.clear();

    isPlayingReference.current = false;
    currentSampleReference.current = 0;
    workletNodeReference.current.port.postMessage({ type: "stop" });
    setState((s) => ({
      ...s,
      isPlaying: false,
      currentTime: 0,
      currentSample: 0,
    }));
  }, []);

  // Seek
  const seek = useCallback(async (timeMs: number) => {
    if (!workletNodeReference.current) return;

    const samplePosition = Math.floor((timeMs / 1000) * sampleRateReference.current);
    currentSampleReference.current = samplePosition;

    workletNodeReference.current.port.postMessage({
      type: "seek",
      samplePosition,
    });

    setState((s) => ({
      ...s,
      currentTime: timeMs,
      currentSample: samplePosition,
    }));
  }, []);

  // Set playback speed
  const setSpeed = useCallback((speed: number) => {
    playbackSpeedReference.current = speed;
    if (workletNodeReference.current) {
      workletNodeReference.current.port.postMessage({
        type: "set_speed",
        speed,
      });
    }
  }, []);

  // Get current sample index
  const getCurrentSampleIndex = useCallback((): number => {
    return currentSampleReference.current;
  }, []);

  // Get current time in milliseconds
  const getCurrentTimeMs = useCallback((): number => {
    return (currentSampleReference.current / sampleRateReference.current) * 1000;
  }, []);

  return {
    state,
    play,
    pause,
    stop,
    seek,
    setSpeed,
    getCurrentSampleIndex,
    getCurrentTimeMs,
  };
}
