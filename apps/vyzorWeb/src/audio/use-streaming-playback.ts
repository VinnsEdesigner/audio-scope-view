import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "@audio-scope-view/api-client/config";

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

const WORKLET_PROCESSOR_NAME = "audio-streaming-processor";

export function useStreamingPlayback(options: StreamingPlaybackOptions): StreamingPlaybackReturn {
  const {
    recordingId,
    chunkSize = 44_100,
    playbackSpeed = 1,
    autoPlay = false,
    onEnded,
    onError,
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

  const audioContextReference = useRef<AudioContext | null>(null);
  const workletNodeReference = useRef<AudioWorkletNode | null>(null);
  const workletLoadedReference = useRef(false);
  const playbackSpeedReference = useRef(playbackSpeed);
  const isPlayingReference = useRef(false);
  const isReadyReference = useRef(false);

  const totalSamplesReference = useRef(0);
  const sampleRateReference = useRef(44_100);
  const currentSampleReference = useRef(0);
  const pendingFetchesReference = useRef<Map<number, AbortController>>(new Map());

  const handleWorkletMessageReference =
    useRef<(message: { type: string; [key: string]: unknown }) => void>(undefined);
  const fetchChunkReference =
    useRef<(startSample: number, endSample: number) => Promise<void>>(undefined);
  const playReference = useRef<() => void>(undefined);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    async function initAudioWithMetadata() {
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

        const context = new AudioContext({ sampleRate: sampleRateReference.current });
        audioContextReference.current = context;

        const workletPath = "/audio/worklets/audio-streaming-processor.js";

        try {
          await context.audioWorklet.addModule(workletPath);
        } catch {
          console.warn("Failed to load worklet from public, using inline fallback");
          const workletResponse = await fetch(workletPath);
          const workletCode = await workletResponse.text();
          const blob = new Blob([workletCode], { type: "application/javascript" });
          const blobUrl = URL.createObjectURL(blob);
          await context.audioWorklet.addModule(blobUrl);
          URL.revokeObjectURL(blobUrl);
        }
        workletLoadedReference.current = true;

        if (cancelled) {
          context.close();
          return;
        }

        const workletNode = new AudioWorkletNode(context, WORKLET_PROCESSOR_NAME, {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });
        workletNodeReference.current = workletNode;

        workletNode.connect(context.destination);

        workletNode.port.addEventListener("message", (event: MessageEvent) => {
          handleWorkletMessageReference.current?.(event.data);
        });

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Worklet config timeout"));
          }, 5000);

          const handler = (event: MessageEvent) => {
            if (event.data.type === "config_acknowledged") {
              clearTimeout(timeout);
              workletNode.port.removeEventListener("message", handler);
              resolve();
            }
          };
          workletNode.port.addEventListener("message", handler);

          workletNode.port.postMessage({
            type: "config",
            recordingId,
            sampleRate: sampleRateReference.current,
            totalSamples: totalSamplesReference.current,
            chunkSize,
            baseUrl: config.graphqlEndpoint.replace("/graphql", ""),
            authHeader: config.bootstrapKey ? `Bearer ${config.bootstrapKey}` : undefined,
          });
        });

        setState((s) => ({ ...s, isReady: true }));
        isReadyReference.current = true;

        if (autoPlay && !cancelled) {
          playReference.current?.();
        }

        cleanup = () => {
          workletNode.disconnect();
          workletNode.port.close();
          context.close();
        };
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

    initAudioWithMetadata();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [recordingId, chunkSize, autoPlay, onError]);

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
      }
    },

    [onEnded],
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

        if (workletNodeReference.current) {
          workletNodeReference.current.port.postMessage(
            {
              type: "chunk_data",
              startSample,
              endSample,
              samples,
            },
            [samples.buffer],
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

  fetchChunkReference.current = fetchChunk;

  const play = useCallback(async () => {
    if (!workletNodeReference.current || !audioContextReference.current) {
      return;
    }

    const context = audioContextReference.current;
    if (context.state === "suspended") {
      await context.resume();
    }

    workletNodeReference.current.port.postMessage({
      type: "config",
      recordingId,
      sampleRate: sampleRateReference.current,
      totalSamples: totalSamplesReference.current,
      chunkSize: 44_100,
      baseUrl: config.graphqlEndpoint.replace("/graphql", ""),
      authHeader: config.bootstrapKey ? `Bearer ${config.bootstrapKey}` : undefined,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    isPlayingReference.current = true;
    workletNodeReference.current.port.postMessage({ type: "play" });
    setState((s) => ({ ...s, isPlaying: true }));
  }, [recordingId]);

  playReference.current = play;

  const pause = useCallback(() => {
    if (!workletNodeReference.current) return;

    isPlayingReference.current = false;
    workletNodeReference.current.port.postMessage({ type: "pause" });
    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  const stop = useCallback(() => {
    if (!workletNodeReference.current) return;

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

  const setSpeed = useCallback((speed: number) => {
    playbackSpeedReference.current = speed;
    if (workletNodeReference.current) {
      workletNodeReference.current.port.postMessage({
        type: "set_speed",
        speed,
      });
    }
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
