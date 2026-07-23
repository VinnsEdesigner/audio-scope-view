import { useState, useEffect, useCallback, useRef } from "react";
import { useAudioStore } from "../store";

export interface AudioContextState {
  audioContext: AudioContext | undefined;
  isRunning: boolean;
  sampleRate: number;
  currentTime: number;
}

export interface UseAudioContextOptions {
  latencyHint?: AudioContextLatencyCategory | number;
}

export function useAudioContext(options: UseAudioContextOptions = {}) {
  const { latencyHint = "interactive" } = options;
  
  // Read sampleRate from audio store (settings)
  const { sampleRate } = useAudioStore();
  
  const [state, setState] = useState<AudioContextState>({
    audioContext: undefined,
    isRunning: false,
    sampleRate: 0,
    currentTime: 0,
  });
  const audioContextReference = useRef<AudioContext | undefined>(undefined);

  const createAudioContext = useCallback(() => {
    if (audioContextReference.current) {
      audioContextReference.current.close();
    }

    // Use sampleRate from audio store, fallback to 48000 if not set
    const actualSampleRate = sampleRate || 48000;
    const context = new AudioContext({ sampleRate: actualSampleRate, latencyHint });
    audioContextReference.current = context;

    setState({
      audioContext: context,
      isRunning: context.state === "running",
      sampleRate: context.sampleRate,
      currentTime: context.currentTime,
    });

    return context;
  }, [sampleRate, latencyHint]);

  const resume = useCallback(async () => {
    if (audioContextReference.current && audioContextReference.current.state === "suspended") {
      await audioContextReference.current.resume();
      setState((previous) => ({
        ...previous,
        isRunning: true,
        currentTime: audioContextReference.current?.currentTime ?? 0,
      }));
    }
  }, []);

  const suspend = useCallback(async () => {
    if (audioContextReference.current && audioContextReference.current.state === "running") {
      await audioContextReference.current.suspend();
      setState((previous) => ({
        ...previous,
        isRunning: false,
        currentTime: audioContextReference.current?.currentTime ?? 0,
      }));
    }
  }, []);

  const close = useCallback(async () => {
    if (audioContextReference.current) {
      await audioContextReference.current.close();
      audioContextReference.current = undefined;
      setState({
        audioContext: undefined,
        isRunning: false,
        sampleRate: 0,
        currentTime: 0,
      });
    }
  }, []);

  useEffect(() => {
    createAudioContext();

    return () => {
      if (audioContextReference.current) {
        audioContextReference.current.close();
      }
    };
  }, [createAudioContext]);

  useEffect(() => {
    const context = audioContextReference.current;
    if (!context) return;

    const intervalId = setInterval(() => {
      setState((previous) => ({
        ...previous,
        currentTime: context.currentTime,
      }));
    }, 100);

    return () => clearInterval(intervalId);
  }, []);

  return {
    ...state,
    resume,
    suspend,
    close,
    createAudioContext,
  };
}
