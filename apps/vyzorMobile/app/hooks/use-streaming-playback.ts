import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "../lib/api-config";

// ─────────────────────────────────────────────────────────────────────────────
// RN STREAMING PLAYBACK ADAPTATION (PARTIAL PORT)
//
// The web hook streams playback through an AudioWorkletNode running a WASM DSP
// core on the audio thread. React Native has neither AudioWorklet nor a
// web-style AudioContext, and the `?url` Vite asset imports for the WASM module
// binary have no RN equivalent. Accordingly:
//
//   • The AudioWorkletNode / AudioContext / WASM DSP worklet thread is replaced
//     with documented NO-OP placeholders. The state machine (isPlaying /
//     currentTime / currentSample / bufferedChunks) still advances so UI and
//     prefetch stay correct, but no audio is emitted and no DSP frames are
//     produced.
//   • The per-block DSP frame callback `onDspFrame` is kept in the interface —
//     a future native equivalent (e.g. a native DSP bridge producing magnitudes
//     + analysis per block) would feed it.
//   • The Vite-only `?url` imports for the WASM module/binary are REMOVED; the
//     worklet module path ("/audio/worklets/...") is web-only and is not
//     referenced here.
//
// The data layer is live: the metadata fetch, the chunk-fetching logic, the
// pending-fetch AbortController map, and the state machine. Audio output +
// per-block DSP await a native player (e.g. Oboe) and a native DSP bridge.
// ─────────────────────────────────────────────────────────────────────────────

// The web hook imports `WaveformAnalysis` from "@audio-scope-view/dsp-wasm",
// which is a web-only package not present in the RN dependency tree. We mirror
// the shape locally so the public `onDspFrame` signature stays stable without
// pulling in the WASM package. When a native DSP bridge lands it can either
// re-export the canonical type from a shared package or populate this shape.
export interface WaveformAnalysis {
  [key: string]: unknown;
}

export interface StreamingPlaybackState {
  isLoading: boolean;
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number;
  duration: number;
  currentSample: number;
  totalSamples: number;
  bufferedChunks: number;
  error: Error | undefined;
  isBuffering: boolean;
}

export interface StreamingPlaybackOptions {
  recordingId: string;

  chunkSize?: number;

  playbackSpeed?: number;

  autoPlay?: boolean;

  onEnded?: () => void;

  onError?: (error: Error) => void;

  /** Called for each per-block DSP frame computed on the worklet thread. */
  onDspFrame?: (frame: {
    magnitudes: Float32Array;
    analysis: WaveformAnalysis | null;
    sampleRate: number;
  }) => void;
}

export interface StreamingPlaybackReturn {
  state: StreamingPlaybackState;

  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeMs: number) => void;
  setSpeed: (speed: number) => void;

  getCurrentSampleIndex: () => number;
  getCurrentTimeMs: () => number;
}

export function useStreamingPlayback(options: StreamingPlaybackOptions): StreamingPlaybackReturn {
  const {
    recordingId,
    chunkSize = 44_100,
    playbackSpeed = 1,
    autoPlay = false,
    onEnded,
    onError,
    onDspFrame,
  } = options;

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

  // AudioWorkletNode / AudioContext refs removed (RN has neither). The
  // workletLoaded flag stays as a state-machine seam.
  const workletLoadedReference = useRef(false);
  const playbackSpeedReference = useRef(playbackSpeed);
  const isPlayingReference = useRef(false);
  const isReadyReference = useRef(false);

  const totalSamplesReference = useRef(0);
  const sampleRateReference = useRef(44_100);
  const currentSampleReference = useRef(0);
  const pendingFetchesReference = useRef<Map<number, AbortController>>(new Map());

  // Wall-clock timer for advancing currentTime/currentSample in lieu of the
  // worklet's position_update messages.
  const startTimeReference = useRef<number>(0);
  const pausedAtReference = useRef<number>(0);
  const animationFrameReference = useRef<number | undefined>(undefined);

  const handleWorkletMessageReference =
    useRef<((message: { type: string; [key: string]: unknown }) => void) | undefined>(undefined);
  const fetchChunkReference =
    useRef<((startSample: number, endSample: number) => Promise<void>) | undefined>(undefined);
  const playReference = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function initWithMetadata() {
      cancelled = false;

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

        if (cancelled) {
          return;
        }

        totalSamplesReference.current = metadata.sample_count;
        sampleRateReference.current = metadata.sample_rate || 44_100;
        const durationMs = metadata.duration_ms;

        setState((s) => ({
          ...s,
          isLoading: false,
          duration: durationMs,
          totalSamples: metadata.sample_count,
        }));

        // NO-OP audio init: on the web this constructed an AudioContext,
        // loaded the AudioWorklet module (web-only path
        // "/audio/worklets/audio-streaming-processor.js"), created an
        // AudioWorkletNode, and posted a `config` message (including the
        // Vite-resolved `?url` WASM asset URLs). RN has none of these, so we
        // only mark the pipeline ready. The `?url` WASM imports are removed
        // (see file header); the worklet module path is web-only.
        workletLoadedReference.current = true;

        if (cancelled) {
          return;
        }

        setState((s) => ({ ...s, isReady: true }));
        isReadyReference.current = true;

        if (autoPlay && !cancelled) {
          playReference.current?.();
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[Hook] Error initializing audio:", error);
          const error_ = error instanceof Error ? error : new Error(String(error));
          setState((s) => ({ ...s, error: error_, isReady: false }));
          isReadyReference.current = false;
          onError?.(error_);
        }
      }
    }

    initWithMetadata();

    return () => {
      cancelled = true;
    };
  }, [recordingId, chunkSize, autoPlay, onError]);

  // The web hook routed AudioWorklet port messages here. With the worklet gone,
  // this handler is retained for shape parity but only the synthetic
  // position_update path (used by the wall-clock timer) is meaningful. The
  // `frame` / `dsp_ready` / `dsp_error` cases stay as no-op seams so a future
  // native DSP bridge can wire back through the same message contract.
  const handleWorkletMessage = useCallback(
    (message: { type: string; [key: string]: unknown }) => {
      switch (message.type) {
        case "ready": {
          break;
        }

        case "request_chunk": {
          fetchChunkReference.current?.(message.startSample as number, message.endSample as number);
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

        case "dsp_ready": {
          // The WASM DSP core finished loading on the worklet thread; per-block
          // frames would now arrive during playback. NO-OP on RN — there is no
          // worklet thread, so no DSP core loads. `onDspFrame` is never
          // invoked until a native DSP bridge supplies frames.
          break;
        }

        case "dsp_error": {
          // Playback continues (PCM still plays); only the per-block DSP path
          // is unavailable. Surface as a non-fatal warning.
          console.warn(
            "[playback] WASM DSP core failed to load on the worklet thread; " +
              "playing audio without per-block DSP frames:",
            message.message,
          );
          break;
        }

        case "frame": {
          // Per-block DSP frame from the played samples, computed on the audio
          // thread by the C++ core. Never produced on RN today; a native DSP
          // bridge would call onDspFrame directly instead of routing here.
          onDspFrame?.({
            magnitudes: message.magnitudes as Float32Array,
            analysis: (message.analysis as WaveformAnalysis | null) ?? null,
            sampleRate: message.sampleRate as number,
          });
          break;
        }
      }
    },

    [onEnded, onDspFrame],
  );

  handleWorkletMessageReference.current = handleWorkletMessage;

  const fetchChunk = useCallback(
    async (startSample: number, endSample: number) => {
      const baseUrl = config.graphqlEndpoint.replace("/graphql", "");

      if (pendingFetchesReference.current.has(startSample)) {
        return;
      }

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

        const samples = new Float32Array(buffer.byteLength / 4);
        const view = new DataView(buffer);
        for (let index = 0; index < samples.length; index++) {
          samples[index] = view.getFloat32(index * 4, true);
        }

        // The web hook posted `chunk_data` to the AudioWorkletNode's port for
        // playback. RN has no worklet, so decoded samples are discarded for
        // now — a native player would consume them here. Fetching still runs so
        // the buffer_status / prefetched-chunk behavior mirrors the web hook.
        if (workletLoadedReference.current) {
          // NO-OP: no workletNodeReference.current.port.postMessage(...) target.
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

  fetchChunkReference.current = fetchChunk;

  // Advances currentTime / currentSample from the wall clock in lieu of the
  // worklet's position_update messages.
  const updatePlaybackTime = useCallback(() => {
    if (!isPlayingReference.current) return;

    const elapsedSeconds = performance.now() / 1000 - startTimeReference.current;
    const currentTimeMs =
      elapsedSeconds * 1000 * playbackSpeedReference.current + pausedAtReference.current;
    const currentSample = Math.floor((currentTimeMs / 1000) * sampleRateReference.current);

    if (currentSample >= totalSamplesReference.current) {
      currentSampleReference.current = totalSamplesReference.current;
      isPlayingReference.current = false;
      setState((s) => ({
        ...s,
        isPlaying: false,
        currentSample: totalSamplesReference.current,
        currentTime: state.duration,
      }));
      pausedAtReference.current = 0;
      onEnded?.();
      return;
    }

    currentSampleReference.current = currentSample;
    setState((s) => ({ ...s, currentTime: currentTimeMs, currentSample }));
    animationFrameReference.current = requestAnimationFrame(updatePlaybackTime);
  }, [state.duration, onEnded]);

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

  // NO-OP play: on the web this resumed the AudioContext and posted `config` +
  // `play` to the worklet (passing the Vite `?url` WASM asset URLs). RN has no
  // context/worklet, so we only seed the start timestamp so the wall-clock
  // timer advances state.
  const play = useCallback(() => {
    if (!isReadyReference.current) {
      return;
    }

    isPlayingReference.current = true;
    startTimeReference.current = performance.now() / 1000;
    setState((s) => ({ ...s, isPlaying: true }));
  }, []);

  playReference.current = play;

  const pause = useCallback(() => {
    const elapsedSeconds = performance.now() / 1000 - startTimeReference.current;
    pausedAtReference.current =
      elapsedSeconds * 1000 * playbackSpeedReference.current + pausedAtReference.current;

    isPlayingReference.current = false;
    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  const stop = useCallback(() => {
    for (const controller of pendingFetchesReference.current.values()) {
      controller.abort();
    }
    pendingFetchesReference.current.clear();

    isPlayingReference.current = false;
    currentSampleReference.current = 0;
    pausedAtReference.current = 0;
    setState((s) => ({
      ...s,
      isPlaying: false,
      currentTime: 0,
      currentSample: 0,
    }));
  }, []);

  const seek = useCallback((timeMs: number) => {
    const samplePosition = Math.floor((timeMs / 1000) * sampleRateReference.current);
    currentSampleReference.current = samplePosition;
    pausedAtReference.current = timeMs;

    setState((s) => ({
      ...s,
      currentTime: timeMs,
      currentSample: samplePosition,
    }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    playbackSpeedReference.current = speed;
  }, []);

  const getCurrentSampleIndex = useCallback((): number => {
    return currentSampleReference.current;
  }, []);

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
