import { useCallback, useRef, useState } from "react";
import {
  normalizeAudioData,
  calculateRMS,
  calculatePeak,
  calculateFrequency,
  downsampleWaveform,
  collectSamples,
} from "@audio-scope-view/api-client/domain/_shared/audio-utilities";

export type RecordingState = "idle" | "recording" | "paused";

export interface UseAudioAnalyzerOptions {
  deviceId?: string;
  desiredSampleRate?: number;
  fftSize?: number;
  smoothingTimeConstant?: number;
  waveformPoints?: number;
  sampleCollectionInterval?: number;
}

export interface AudioAnalyzerState {
  recordingState: RecordingState;
  volumeLevel: number;
  peakLevel: number;
  waveformData: number[];
  sampleRate: number;
  duration: number;
  samples: Float32Array;
  vpp: number;
  frequency: number;
  windowMs: number;
}

export interface UseAudioAnalyzerReturn extends AudioAnalyzerState {
  startCapture: () => Promise<void>;
  pauseCapture: () => void;
  resumeCapture: () => void;
  stopCapture: () => void;
  discardCapture: () => void;
  isCapturing: boolean;
  error: Error | undefined;
}

const DEFAULT_FFT_SIZE = 4096;
const DEFAULT_SMOOTHING = 0.3;
const DEFAULT_WAVEFORM_POINTS = 64;
const DEFAULT_SAMPLE_INTERVAL = 16;

export function useAudioAnalyzer(options: UseAudioAnalyzerOptions = {}): UseAudioAnalyzerReturn {
  const {
    deviceId,
    desiredSampleRate,
    fftSize = DEFAULT_FFT_SIZE,
    smoothingTimeConstant = DEFAULT_SMOOTHING,
    waveformPoints = DEFAULT_WAVEFORM_POINTS,
    sampleCollectionInterval = DEFAULT_SAMPLE_INTERVAL,
  } = options;

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [sampleRate, setSampleRate] = useState(44_100);
  const [duration, setDuration] = useState(0);
  const [samples, setSamples] = useState<Float32Array>(new Float32Array());
  const [vpp, setVpp] = useState(0);
  const [frequency, setFrequency] = useState(0);
  const [error, setError] = useState<Error | undefined>();

  const audioContextReference = useRef<AudioContext | undefined>(undefined);
  const analyserReference = useRef<AnalyserNode | undefined>(undefined);
  const mediaStreamReference = useRef<MediaStream | undefined>(undefined);
  const animationFrameReference = useRef<number | undefined>(undefined);
  const durationIntervalReference = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const collectedSamplesReference = useRef<Float32Array>(new Float32Array());

  const isCapturing = recordingState !== "idle";

  const cleanup = useCallback(() => {
    if (animationFrameReference.current) {
      cancelAnimationFrame(animationFrameReference.current);
      animationFrameReference.current = undefined;
    }

    if (durationIntervalReference.current) {
      clearInterval(durationIntervalReference.current);
      durationIntervalReference.current = undefined;
    }

    if (mediaStreamReference.current) {
      for (const track of mediaStreamReference.current.getTracks()) track.stop();
      mediaStreamReference.current = undefined;
    }

    if (audioContextReference.current) {
      audioContextReference.current.close();
      audioContextReference.current = undefined;
    }

    analyserReference.current = undefined;
  }, []);

  const startCapture = useCallback(async () => {
    try {
      setError(undefined);
      cleanup();

      const audioConstraints: MediaTrackConstraints = {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: { exact: false },
        noiseSuppression: { exact: false },
        autoGainControl: { exact: false },
      };

      // Add sampleRate constraint if specified (browser may not honor all values)
      if (desiredSampleRate) {
        audioConstraints.sampleRate = { exact: desiredSampleRate };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      // Create AudioContext with desired sample rate if specified
      const audioContextOptions: AudioContextOptions = {};
      if (desiredSampleRate) {
        audioContextOptions.sampleRate = desiredSampleRate;
      }
      const audioContext = new AudioContext(audioContextOptions);
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = smoothingTimeConstant;
      source.connect(analyser);

      mediaStreamReference.current = stream;
      audioContextReference.current = audioContext;
      analyserReference.current = analyser;
      setSampleRate(audioContext.sampleRate);

      collectedSamplesReference.current = new Float32Array();

      setDuration(0);
      durationIntervalReference.current = setInterval(() => {
        setDuration((d) => d + 100);
      }, 100);

      setRecordingState("recording");

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVisualization = () => {
        if (
          !analyserReference.current ||
          !audioContextReference.current ||
          recordingState !== "recording"
        ) {
          return;
        }

        analyserReference.current.getByteTimeDomainData(dataArray);

        const normalizedData = normalizeAudioData(dataArray);

        const rms = calculateRMS(normalizedData);
        const peak = calculatePeak(normalizedData);
        const freq = calculateFrequency(normalizedData, audioContextReference.current.sampleRate);

        setVolumeLevel(Math.min(rms * 3, 1));
        setPeakLevel(Math.min(peak, 1));
        setVpp(peak * 2);
        setFrequency(freq);

        const waveform = downsampleWaveform(normalizedData, waveformPoints);
        setWaveformData(waveform);

        const collected = collectSamples(dataArray, sampleCollectionInterval);
        const currentSamples = collectedSamplesReference.current;
        collectedSamplesReference.current = new Float32Array(
          currentSamples.length + collected.length,
        );
        collectedSamplesReference.current.set(currentSamples);
        collectedSamplesReference.current.set(collected, currentSamples.length);

        animationFrameReference.current = requestAnimationFrame(updateVisualization);
      };

      updateVisualization();
    } catch (error_) {
      console.error("Failed to start audio capture:", error_);
      setError(error_ instanceof Error ? error_ : new Error("Failed to start capture"));
      cleanup();
    }
  }, [
    deviceId,
    desiredSampleRate,
    fftSize,
    smoothingTimeConstant,
    waveformPoints,
    sampleCollectionInterval,
    cleanup,
    recordingState,
  ]);

  const pauseCapture = useCallback(() => {
    if (durationIntervalReference.current) {
      clearInterval(durationIntervalReference.current);
      durationIntervalReference.current = undefined;
    }
    setRecordingState("paused");
  }, []);

  const resumeCapture = useCallback(() => {
    durationIntervalReference.current = setInterval(() => {
      setDuration((d) => d + 100);
    }, 100);
    setRecordingState("recording");
  }, []);

  const stopCapture = useCallback(() => {
    setSamples(collectedSamplesReference.current);
    cleanup();
    setRecordingState("idle");
  }, [cleanup]);

  const discardCapture = useCallback(() => {
    collectedSamplesReference.current = new Float32Array();
    setSamples(new Float32Array());
    cleanup();
    setRecordingState("idle");
    setVolumeLevel(0);
    setPeakLevel(0);
    setWaveformData([]);
    setDuration(0);
    setVpp(0);
    setFrequency(0);
  }, [cleanup]);

  return {
    recordingState,
    volumeLevel,
    peakLevel,
    waveformData,
    sampleRate,
    duration,
    samples,
    vpp,
    frequency,
    windowMs: 0,
    isCapturing,
    error,

    startCapture,
    pauseCapture,
    resumeCapture,
    stopCapture,
    discardCapture,
  };
}
