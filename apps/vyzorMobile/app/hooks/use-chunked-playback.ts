import { useCallback, useEffect, useRef, useState } from "react";
import type { RecordingMetadata } from "@audio-scope-view/api-client/domain/recording";
import {
  SampleChunkService,
  DEFAULT_CHUNK_SIZE,
} from "@audio-scope-view/api-client/domain/recording";

// ─────────────────────────────────────────────────────────────────────────────
// RN PLAYBACK ADAPTATION
//
// The web hook drives playback through Web Audio (AudioContext /
// AudioBufferSourceNode / createBuffer), which does not exist on React Native.
// There is no native audio output path wired up yet, so the playback surface
// below is a NO-OP: play/pause/stop/seek/setSpeed still advance the
// isPlaying / currentTime state machine so UI and data prefetching behave
// correctly, but no audio is emitted.
//
// Audio output awaits a native player — most likely a native Oboe output
// stream (low-latency AAudio/OpenSL ES) fed from the chunk cache populated by
// SampleChunkService. Until that lands, treat this hook as the data layer +
// state machine for chunked playback: metadata loading, chunk fetching, the
// chunk Map cache, getCurrentSampleIndex / getVisibleSamples / preloadAround
// are all live.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChunkedPlaybackState {
  isLoading: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  error: Error | undefined;
  chunksLoaded: number;
  totalChunks: number;
}

export interface ChunkedPlaybackOptions {
  recordingId: string;

  chunkSize?: number;

  playbackSpeed?: number;

  autoPlay?: boolean;

  onEnded?: () => void;
}

export interface ChunkedPlaybackReturn {
  state: ChunkedPlaybackState;

  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeMs: number) => void;
  setSpeed: (speed: number) => void;

  getCurrentSampleIndex: () => number;
  getVisibleSamples: (centerTimeMs: number, windowSizeSamples: number) => Float32Array;
  preloadAround: (timeMs: number, radiusMs: number, sampleRate: number) => void;
}

export function useChunkedPlayback(options: ChunkedPlaybackOptions): ChunkedPlaybackReturn {
  const { recordingId, chunkSize = DEFAULT_CHUNK_SIZE, autoPlay = false, onEnded } = options;

  const [state, setState] = useState<ChunkedPlaybackState>({
    isLoading: true,
    isPlaying: false,
    currentTime: 0,
    duration: 0,

    error: undefined,
    chunksLoaded: 0,
    totalChunks: 0,
  });

  // Web Audio refs removed — RN has no AudioContext / AudioBufferSourceNode /
  // AudioBuffer. These timers drive the (no-op) state machine in lieu of the
  // audio clock that used to advance currentTime.
  const startTimeReference = useRef<number>(0);
  const pausedAtReference = useRef<number>(0);
  const playbackSpeedReference = useRef<number>(options.playbackSpeed ?? 1);
  const animationFrameReference = useRef<number | undefined>(undefined);
  const serviceReference = useRef<SampleChunkService>(new SampleChunkService());
  const metadataReference = useRef<RecordingMetadata | undefined>(undefined);
  const loadedChunksReference = useRef<Map<number, Float32Array>>(new Map());
  const totalChunksLoadedReference = useRef<number>(0);

  const calculateTotalChunks = useCallback(
    (sampleCount: number): number => {
      return Math.ceil(sampleCount / chunkSize);
    },
    [chunkSize],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMetadata() {
      setState((s) => ({ ...s, isLoading: true, error: undefined }));

      try {
        const meta = await serviceReference.current.getMetadata(recordingId);
        if (cancelled) return;

        metadataReference.current = meta;
        const totalChunks = calculateTotalChunks(meta.sample_count);

        setState((s) => ({
          ...s,
          isLoading: false,
          duration: meta.duration_ms,
          totalChunks,
        }));

        if (autoPlay) {
          const firstChunk = await serviceReference.current.getSamples(recordingId, 0, chunkSize);
          if (!cancelled) {
            loadedChunksReference.current.set(0, new Float32Array(firstChunk.samples));
            totalChunksLoadedReference.current = 1;
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

  // No AudioContext to create/teardown on RN. The web hook's second effect
  // (AudioContext construction + sourceNode cleanup) is a no-op here.
  useEffect(() => {
    return () => {
      if (animationFrameReference.current) {
        cancelAnimationFrame(animationFrameReference.current);
      }
    };
  }, []);

  // Advances currentTime using the wall clock instead of the (absent) audio
  // context's currentTime. No samples are played — this keeps the state
  // machine and dependent UI (progress, ended detection) working while audio
  // output awaits a native player.
  const updatePlaybackTime = useCallback(() => {
    if (!state.isPlaying) return;

    const currentTimeSeconds = performance.now() / 1000 - startTimeReference.current;
    const currentTimeMs =
      currentTimeSeconds * 1000 * playbackSpeedReference.current + pausedAtReference.current;

    if (currentTimeMs >= state.duration) {
      setState((s) => ({ ...s, isPlaying: false, currentTime: state.duration }));
      pausedAtReference.current = 0;
      onEnded?.();
      return;
    }

    setState((s) => ({ ...s, currentTime: currentTimeMs }));
    animationFrameReference.current = requestAnimationFrame(updatePlaybackTime);
  }, [state.isPlaying, state.duration, onEnded]);

  useEffect(() => {
    if (state.isPlaying) {
      animationFrameReference.current = requestAnimationFrame(updatePlaybackTime);
    } else if (animationFrameReference.current) {
      cancelAnimationFrame(animationFrameReference.current);
    }

    return () => {
      if (animationFrameReference.current) {
        cancelAnimationFrame(animationFrameReference.current);
      }
    };
  }, [state.isPlaying, updatePlaybackTime]);

  const loadChunk = useCallback(
    async (startSample: number): Promise<Float32Array | undefined> => {
      const chunkKey = Math.floor(startSample / chunkSize) * chunkSize;

      const cached = loadedChunksReference.current.get(chunkKey);
      if (cached) {
        return cached;
      }

      try {
        const chunk = await serviceReference.current.getSamples(
          recordingId,
          chunkKey,
          Math.min(
            chunkKey + chunkSize,
            metadataReference.current?.sample_count ?? chunkKey + chunkSize,
          ),
        );

        const samples = new Float32Array(chunk.samples);
        loadedChunksReference.current.set(chunkKey, samples);
        totalChunksLoadedReference.current = loadedChunksReference.current.size;
        setState((s) => ({ ...s, chunksLoaded: totalChunksLoadedReference.current }));

        return samples;
      } catch (error) {
        console.error("Failed to load chunk:", error);
        return undefined;
      }
    },
    [recordingId, chunkSize],
  );

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
      for (let index = startChunk; index <= endChunk; index++) {
        const chunkStart = index * chunkSize;
        if (!loadedChunksReference.current.has(chunkStart)) {
          chunksToLoad.push(chunkStart);
        }
      }

      await Promise.all(chunksToLoad.map((start) => loadChunk(start)));
    },
    [chunkSize, loadChunk],
  );

  // buildAudioBuffer() used to assemble an AudioBuffer for the
  // AudioBufferSourceNode. RN has no AudioBuffer, and no player to consume one,
  // so this is intentionally a no-op (kept as a seam for the future native
  // player to populate a native PCM buffer from the chunk cache).
  const buildAudioBuffer = useCallback(async (): Promise<void> => {
    return undefined;
  }, []);

  // NO-OP playback: no AudioContext to resume / no sourceNode to start. We only
  // seed the start timestamp so the wall-clock timer above can advance
  // currentTime, and preload the chunks around the resume position so the cache
  // is warm for the eventual native player.
  const play = useCallback(async () => {
    const sampleRate = metadataReference.current?.sample_rate || 44_100;
    const currentSample = Math.floor((pausedAtReference.current / 1000) * sampleRate);
    const startChunk = Math.floor(currentSample / chunkSize);

    const chunksToLoad = [startChunk, startChunk + 1, startChunk - 1, startChunk + 2].filter(
      (c) => c >= 0,
    );

    await Promise.all(chunksToLoad.map((c) => loadChunk(c * chunkSize)));

    await buildAudioBuffer();

    startTimeReference.current = performance.now() / 1000;
    setState((s) => ({ ...s, isPlaying: true }));
  }, [loadChunk, buildAudioBuffer, chunkSize]);

  // NO-OP pause: no sourceNode to stop. Capture the elapsed time so the next
  // play() resumes from here, then flip isPlaying.
  const pause = useCallback(() => {
    const currentTimeSeconds = performance.now() / 1000 - startTimeReference.current;
    pausedAtReference.current =
      currentTimeSeconds * 1000 * playbackSpeedReference.current + pausedAtReference.current;

    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  const stop = useCallback(() => {
    pausedAtReference.current = 0;
    setState((s) => ({ ...s, isPlaying: false, currentTime: 0 }));
  }, []);

  const seek = useCallback(
    async (timeMs: number) => {
      const wasPlaying = state.isPlaying;

      if (wasPlaying) {
        pause();
      }

      pausedAtReference.current = Math.max(0, Math.min(timeMs, state.duration));
      setState((s) => ({ ...s, currentTime: pausedAtReference.current }));

      await preloadAround(timeMs, 2000, metadataReference.current?.sample_rate || 44_100);

      if (wasPlaying) {
        await play();
      }
    },

    [state.isPlaying, state.duration, pause, play, preloadAround],
  );

  // NO-OP setSpeed: no sourceNode.playbackRate to set. Just record the speed so
  // the wall-clock timer scales currentTime correctly.
  const setSpeed = useCallback((speed: number) => {
    playbackSpeedReference.current = speed;
  }, []);

  const getCurrentSampleIndex = useCallback((): number => {
    const sampleRate = metadataReference.current?.sample_rate || 44_100;
    return Math.floor((state.currentTime / 1000) * sampleRate);
  }, [state.currentTime]);

  const getVisibleSamples = useCallback(
    (centerTimeMs: number, windowSizeSamples: number): Float32Array => {
      const sampleRate = metadataReference.current?.sample_rate || 44_100;
      const sampleCount = metadataReference.current?.sample_count || 0;

      const centerSample = Math.floor((centerTimeMs / 1000) * sampleRate);
      const halfWindow = Math.floor(windowSizeSamples / 2);
      const startSample = Math.max(0, centerSample - halfWindow);
      const endSample = Math.min(sampleCount, startSample + windowSizeSamples);

      const startChunk = Math.floor(startSample / chunkSize) * chunkSize;
      const endChunk = Math.floor(endSample / chunkSize) * chunkSize;

      const result: number[] = [];
      for (let chunkStart = startChunk; chunkStart <= endChunk; chunkStart += chunkSize) {
        const chunk = loadedChunksReference.current.get(chunkStart);
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
    [chunkSize],
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
