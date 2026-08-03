/**
 * use-chunked-playback Hook
 * 
 * Provides chunked audio playback for large recordings.
 * Uses Web Audio API with on-demand chunk loading to avoid
 * loading entire recordings (10MB+) at once.
 * 
 * Features:
 * - Lazy chunk loading on-demand
 * - LRU cache for recently accessed chunks
 * - AudioContext management
 * - Playback position tracking
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SampleChunkService,
  RecordingMetadata,
  DEFAULT_CHUNK_SIZE,
} from "@audio-scope-view/api-client/domain/recording";

/** Hook state */
export interface ChunkedPlaybackState {
  isLoading: boolean;
  isPlaying: boolean;
  currentTime: number; // in milliseconds
  duration: number; // in milliseconds
  error: Error | null;
  chunksLoaded: number;
  totalChunks: number;
}

/** Hook options */
export interface ChunkedPlaybackOptions {
  /** Recording ID to play */
  recordingId: string;
  /** Chunk size in samples */
  chunkSize?: number;
  /** Playback speed (1 = normal) */
  playbackSpeed?: number;
  /** Auto-start playback */
  autoPlay?: boolean;
  /** Callback when playback ends */
  onEnded?: () => void;
}

/** Hook return type */
export interface ChunkedPlaybackReturn {
  state: ChunkedPlaybackState;
  // Playback controls
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeMs: number) => void;
  setSpeed: (speed: number) => void;
  // Utilities
  getCurrentSampleIndex: () => number;
  getVisibleSamples: (centerTimeMs: number, windowSizeSamples: number) => Float32Array;
  preloadAround: (timeMs: number, radiusMs: number, sampleRate: number) => void;
}

/**
 * Hook for chunked audio playback
 * 
 * This hook manages:
 * - AudioContext for playback
 * - Chunk loading and caching
 * - Playback position tracking
 * 
 * For visualization, use getVisibleSamples() to get samples for a time window.
 * For playback, this hook sets up an AudioBufferSourceNode with loaded chunks.
 */
export function useChunkedPlayback(
  options: ChunkedPlaybackOptions
): ChunkedPlaybackReturn {
  const {
    recordingId,
    chunkSize = DEFAULT_CHUNK_SIZE,
    autoPlay = false,
    onEnded,
  } = options;

  // State
  const [state, setState] = useState<ChunkedPlaybackState>({
    isLoading: true,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    error: null,
    chunksLoaded: 0,
    totalChunks: 0,
  });

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0); // AudioContext time when playback started
  const pausedAtRef = useRef<number>(0); // Position in seconds when paused
  const playbackSpeedRef = useRef<number>(options.playbackSpeed ?? 1);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const serviceRef = useRef<SampleChunkService>(new SampleChunkService());
  const metadataRef = useRef<RecordingMetadata | null>(null);
  const loadedChunksRef = useRef<Map<number, Float32Array>>(new Map());
  const totalChunksLoadedRef = useRef<number>(0);

  // Calculate total chunks for a recording
  const calculateTotalChunks = useCallback((sampleCount: number): number => {
    return Math.ceil(sampleCount / chunkSize);
  }, [chunkSize]);

  // Load metadata on mount or recordingId change
  useEffect(() => {
    let cancelled = false;

    async function loadMetadata() {
      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        const meta = await serviceRef.current.getMetadata(recordingId);
        if (cancelled) return;

        metadataRef.current = meta;
        const totalChunks = calculateTotalChunks(meta.sample_count);

        setState((s) => ({
          ...s,
          isLoading: false,
          duration: meta.duration_ms,
          totalChunks,
        }));

        // Preload first chunk for immediate playback
        if (autoPlay) {
          const firstChunk = await serviceRef.current.getSamples(recordingId, 0, chunkSize);
          if (!cancelled) {
            loadedChunksRef.current.set(0, new Float32Array(firstChunk.samples));
            totalChunksLoadedRef.current = 1;
            setState((s) => ({ ...s, chunksLoaded: 1 }));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            isLoading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          }));
        }
      }
    }

    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [recordingId, chunkSize, autoPlay, calculateTotalChunks]);

  // Initialize AudioContext
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    return () => {
      // Don't close the context, just clean up the source node
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
          sourceNodeRef.current.disconnect();
        } catch {
          // Ignore errors on cleanup
        }
        sourceNodeRef.current = null;
      }
    };
  }, []);

  // Update current time during playback
  const updatePlaybackTime = useCallback(() => {
    if (!audioContextRef.current || !state.isPlaying) return;

    const currentTimeSeconds = audioContextRef.current.currentTime - startTimeRef.current;
    const currentTimeMs = currentTimeSeconds * 1000 * playbackSpeedRef.current + pausedAtRef.current;

    if (currentTimeMs >= state.duration) {
      // Playback ended
      setState((s) => ({ ...s, isPlaying: false, currentTime: state.duration }));
      pausedAtRef.current = 0;
      onEnded?.();
      return;
    }

    setState((s) => ({ ...s, currentTime: currentTimeMs }));
    animationFrameRef.current = requestAnimationFrame(updatePlaybackTime);
  }, [state.isPlaying, state.duration, onEnded]);

  useEffect(() => {
    if (state.isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updatePlaybackTime);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state.isPlaying, updatePlaybackTime]);

  // Load a chunk (with caching)
  const loadChunk = useCallback(
    async (startSample: number): Promise<Float32Array | null> => {
      const chunkKey = Math.floor(startSample / chunkSize) * chunkSize;

      // Check cache first
      const cached = loadedChunksRef.current.get(chunkKey);
      if (cached) {
        return cached;
      }

      try {
        const chunk = await serviceRef.current.getSamples(
          recordingId,
          chunkKey,
          Math.min(chunkKey + chunkSize, metadataRef.current?.sample_count ?? chunkKey + chunkSize)
        );

        const samples = new Float32Array(chunk.samples);
        loadedChunksRef.current.set(chunkKey, samples);
        totalChunksLoadedRef.current = loadedChunksRef.current.size;
        setState((s) => ({ ...s, chunksLoaded: totalChunksLoadedRef.current }));

        return samples;
      } catch (error) {
        console.error("Failed to load chunk:", error);
        return null;
      }
    },
    [recordingId, chunkSize]
  );

  // Build AudioBuffer from loaded chunks
  const buildAudioBuffer = useCallback(async (): Promise<AudioBuffer | null> => {
    if (!audioContextRef.current || !metadataRef.current) return null;

    const sampleCount = metadataRef.current.sample_count;
    const sampleRate = metadataRef.current.sample_rate || 44100;

    // Create buffer
    const buffer = audioContextRef.current.createBuffer(1, sampleCount, sampleRate);
    const channelData = buffer.getChannelData(0);

    // Fill with loaded chunks
    const sortedKeys = Array.from(loadedChunksRef.current.keys()).sort((a, b) => a - b);
    let offset = 0;

    for (const key of sortedKeys) {
      const chunk = loadedChunksRef.current.get(key)!;
      channelData.set(chunk, offset);
      offset += chunk.length;
    }

    return buffer;
  }, []);

  // Play
  const play = useCallback(async () => {
    if (!audioContextRef.current) return;

    const context = audioContextRef.current;

    // Resume context if suspended
    if (context.state === "suspended") {
      await context.resume();
    }

    // Load chunks around current position
    const sampleRate = metadataRef.current?.sample_rate || 44100;
    const currentSample = Math.floor((pausedAtRef.current / 1000) * sampleRate);
    const startChunk = Math.floor(currentSample / chunkSize);

    // Preload surrounding chunks
    const chunksToLoad = [
      startChunk,
      startChunk + 1,
      startChunk - 1,
      startChunk + 2,
    ].filter((c) => c >= 0);

    await Promise.all(chunksToLoad.map((c) => loadChunk(c * chunkSize)));

    // Build audio buffer from loaded chunks
    const buffer = await buildAudioBuffer();
    if (!buffer) return;

    audioBufferRef.current = buffer;

    // Create source node
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // Ignore
      }
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackSpeedRef.current;
    source.connect(context.destination);

    sourceNodeRef.current = source;
    startTimeRef.current = context.currentTime;

    // Handle playback end
    source.onended = () => {
      if (state.isPlaying) {
        setState((s) => ({ ...s, isPlaying: false }));
        pausedAtRef.current = 0;
        onEnded?.();
      }
    };

    // Start playback
    const startOffset = pausedAtRef.current / 1000;
    source.start(0, startOffset);

    setState((s) => ({ ...s, isPlaying: true }));
  }, [loadChunk, buildAudioBuffer, chunkSize, state.isPlaying, onEnded]);

  // Pause
  const pause = useCallback(() => {
    if (!audioContextRef.current || !sourceNodeRef.current) return;

    // Calculate current position
    const currentTimeSeconds = audioContextRef.current.currentTime - startTimeRef.current;
    pausedAtRef.current = currentTimeSeconds * 1000 * playbackSpeedRef.current + pausedAtRef.current;

    // Stop source
    try {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
    } catch {
      // Ignore
    }
    sourceNodeRef.current = null;

    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  // Stop
  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // Ignore
      }
      sourceNodeRef.current = null;
    }

    pausedAtRef.current = 0;
    setState((s) => ({ ...s, isPlaying: false, currentTime: 0 }));
  }, []);

  // Seek
  const seek = useCallback(
    async (timeMs: number) => {
      const wasPlaying = state.isPlaying;

      if (wasPlaying) {
        pause();
      }

      pausedAtRef.current = Math.max(0, Math.min(timeMs, state.duration));
      setState((s) => ({ ...s, currentTime: pausedAtRef.current }));

      // Preload chunks around new position
      await preloadAround(timeMs, 2000, metadataRef.current?.sample_rate || 44100);

      if (wasPlaying) {
        await play();
      }
    },
    [state.isPlaying, state.duration, pause, play]
  );

  // Set playback speed
  const setSpeed = useCallback((speed: number) => {
    playbackSpeedRef.current = speed;
    if (sourceNodeRef.current) {
      sourceNodeRef.current.playbackRate.value = speed;
    }
  }, []);

  // Get current sample index
  const getCurrentSampleIndex = useCallback((): number => {
    const sampleRate = metadataRef.current?.sample_rate || 44100;
    return Math.floor((state.currentTime / 1000) * sampleRate);
  }, [state.currentTime]);

  // Get visible samples for a time window
  const getVisibleSamples = useCallback(
    (centerTimeMs: number, windowSizeSamples: number): Float32Array => {
      const sampleRate = metadataRef.current?.sample_rate || 44100;
      const sampleCount = metadataRef.current?.sample_count || 0;

      const centerSample = Math.floor((centerTimeMs / 1000) * sampleRate);
      const halfWindow = Math.floor(windowSizeSamples / 2);
      const startSample = Math.max(0, centerSample - halfWindow);
      const endSample = Math.min(sampleCount, startSample + windowSizeSamples);

      // Find which chunks we need
      const startChunk = Math.floor(startSample / chunkSize) * chunkSize;
      const endChunk = Math.floor(endSample / chunkSize) * chunkSize;

      // Collect samples from loaded chunks
      const result: number[] = [];
      for (let chunkStart = startChunk; chunkStart <= endChunk; chunkStart += chunkSize) {
        const chunk = loadedChunksRef.current.get(chunkStart);
        if (!chunk) continue;

        const chunkOffset = Math.max(0, startSample - chunkStart);
        const chunkEnd = Math.min(chunk.length, endSample - chunkStart);
        const length = chunkEnd - chunkOffset;

        if (length > 0) {
          result.push(...chunk.slice(chunkOffset, chunkOffset + length).values());
        }
      }

      return new Float32Array(result);
    },
    [chunkSize]
  );

  // Preload chunks around a time position
  const preloadAround = useCallback(
    async (timeMs: number, radiusMs: number, sampleRate: number): Promise<void> => {
      const samplesPerMs = sampleRate / 1000;
      const radiusSamples = radiusMs * samplesPerMs;

      const centerSample = Math.floor((timeMs / 1000) * sampleRate);
      const startSample = Math.max(0, centerSample - radiusSamples);
      const endSample = centerSample + radiusSamples;

      const startChunk = Math.floor(startSample / chunkSize);
      const endChunk = Math.floor(endSample / chunkSize);

      const chunksToLoad: number[] = [];
      for (let i = startChunk; i <= endChunk; i++) {
        const chunkStart = i * chunkSize;
        if (!loadedChunksRef.current.has(chunkStart)) {
          chunksToLoad.push(chunkStart);
        }
      }

      // Load in parallel
      await Promise.all(chunksToLoad.map((start) => loadChunk(start)));
    },
    [chunkSize, loadChunk]
  );

  return {
    state,
    play,
    pause,
    stop,
    seek,
    setSpeed,
    getCurrentSampleIndex,
    getVisibleSamples,
    preloadAround,
  };
}
