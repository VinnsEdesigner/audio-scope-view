import { useCallback, useRef, useState } from "react";
import {
  normalizeAudioData,
  calculateRMS,
  calculatePeak,
  calculateFrequency,
  downsampleWaveform,
} from "@audio-scope-view/api-client/domain/_shared/audio-utilities";

export type RecordingState = "idle" | "recording" | "paused";
export type WaveformType = "sine" | "square" | "sawtooth" | "triangle" | "noise";

export interface UseMockAudioAnalyzerOptions {
  frequency?: number;
  amplitude?: number;
  sampleRate?: number;
  waveformType?: WaveformType;
  waveformPoints?: number;
  noiseLevel?: number;
  smoothingTimeConstant?: number;
  fftSize?: number;
}

export interface AudioAnalyzerState {
  recordingState: RecordingState;
  volumeLevel: number;
  peakLevel: number;
  waveformData: number[];
  sampleRate: number;
  duration: number;
  samples: Float32Array;
  analysisFrame: Float32Array;
  vpp: number;
  frequency: number;
  windowMs: number;
}

export interface UseMockAudioAnalyzerReturn extends AudioAnalyzerState {
  startCapture: () => void;
  pauseCapture: () => void;
  resumeCapture: () => void;
  stopCapture: () => void;
  discardCapture: () => void;
  isCapturing: boolean;
  setFrequency: (freq: number) => void;
  setAmplitude: (amp: number) => void;
  setWaveformType: (type: WaveformType) => void;
  error: Error | undefined;
}

const DEFAULT_FREQUENCY = 440;
const DEFAULT_AMPLITUDE = 0.5;
const DEFAULT_SAMPLE_RATE = 48_000;
const DEFAULT_WAVEFORM_POINTS = 64;
const DEFAULT_NOISE_LEVEL = 0.02;
const DEFAULT_SMOOTHING = 0.3;
const DEFAULT_FFT_SIZE = 4096;

export function useMockAudioAnalyzer(
  options: UseMockAudioAnalyzerOptions = {},
): UseMockAudioAnalyzerReturn {
  const {
    frequency: initialFrequency = DEFAULT_FREQUENCY,
    amplitude: initialAmplitude = DEFAULT_AMPLITUDE,
    sampleRate = DEFAULT_SAMPLE_RATE,
    waveformType = "sine",
    waveformPoints = DEFAULT_WAVEFORM_POINTS,
    noiseLevel = DEFAULT_NOISE_LEVEL,
    smoothingTimeConstant = DEFAULT_SMOOTHING,
    fftSize = DEFAULT_FFT_SIZE,
  } = options;

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [vpp, setVpp] = useState(0);
  const [frequency, setFrequencyState] = useState(initialFrequency);
  const [amplitude, setAmplitudeState] = useState(initialAmplitude);
  const [currentWaveformType, setWaveformTypeState] = useState<WaveformType>(waveformType);
  const [error, setError] = useState<Error | undefined>();

  const audioContextReference = useRef<AudioContext | undefined>(undefined);
  const oscillatorReference = useRef<OscillatorNode | undefined>(undefined);
  const gainReference = useRef<GainNode | undefined>(undefined);
  const analyserReference = useRef<AnalyserNode | undefined>(undefined);
  const noiseSourceReference = useRef<AudioBufferSourceNode | undefined>(undefined);
  const animationFrameReference = useRef<number | undefined>(undefined);
  const durationIntervalReference = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const collectedSamplesReference = useRef<Float32Array>(new Float32Array());
  const samplesReference = useRef<Float32Array>(new Float32Array());

  const isCapturing = recordingState !== "idle";

  const createNoiseSource = useCallback((context: AudioContext): AudioBufferSourceNode => {
    const bufferSize = context.sampleRate * 2;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < bufferSize; index++) {
      data[index] = Math.random() * 2 - 1;
    }

    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    return noise;
  }, []);

  const cleanup = useCallback(() => {
    if (animationFrameReference.current) {
      cancelAnimationFrame(animationFrameReference.current);
      animationFrameReference.current = undefined;
    }

    if (durationIntervalReference.current) {
      clearInterval(durationIntervalReference.current);
      durationIntervalReference.current = undefined;
    }

    if (oscillatorReference.current) {
      oscillatorReference.current.stop();
      oscillatorReference.current.disconnect();
      oscillatorReference.current = undefined;
    }

    if (noiseSourceReference.current) {
      noiseSourceReference.current.stop();
      noiseSourceReference.current.disconnect();
      noiseSourceReference.current = undefined;
    }

    if (gainReference.current) {
      gainReference.current.disconnect();
      gainReference.current = undefined;
    }

    if (analyserReference.current) {
      analyserReference.current.disconnect();
      analyserReference.current = undefined;
    }

    if (audioContextReference.current) {
      audioContextReference.current.close();
      audioContextReference.current = undefined;
    }
  }, []);

  const setFrequency = useCallback((newFrequency: number) => {
    setFrequencyState(newFrequency);
    if (oscillatorReference.current && audioContextReference.current) {
      oscillatorReference.current.frequency.setValueAtTime(
        newFrequency,
        audioContextReference.current.currentTime,
      );
    }
  }, []);

  const startCapture = useCallback(() => {
    try {
      setError(undefined);
      cleanup();

      const audioContext = new AudioContext({ sampleRate });
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = smoothingTimeConstant;

      const oscillator = audioContext.createOscillator();
      if (currentWaveformType !== "noise") {
        oscillator.type = currentWaveformType;
      }
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

      const noiseSource = createNoiseSource(audioContext);
      const noiseGain = audioContext.createGain();
      noiseGain.gain.setValueAtTime(noiseLevel, audioContext.currentTime);

      const mainGain = audioContext.createGain();
      mainGain.gain.setValueAtTime(amplitude, audioContext.currentTime);

      const oscillatorNoiseGain = audioContext.createGain();
      oscillatorNoiseGain.gain.setValueAtTime(1 - noiseLevel * 2, audioContext.currentTime);

      oscillator.connect(oscillatorNoiseGain);
      oscillatorNoiseGain.connect(analyser);

      noiseSource.connect(noiseGain);
      noiseGain.connect(analyser);

      analyser.connect(mainGain);
      mainGain.connect(audioContext.destination);

      oscillator.start();
      noiseSource.start();

      audioContextReference.current = audioContext;
      oscillatorReference.current = oscillator;
      noiseSourceReference.current = noiseSource;
      gainReference.current = mainGain;
      analyserReference.current = analyser;

      collectedSamplesReference.current = new Float32Array();
      samplesReference.current = new Float32Array();

      setDuration(0);
      durationIntervalReference.current = setInterval(() => {
        setDuration((d) => d + 100);
      }, 100);

      setRecordingState("recording");

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const initialSamples: number[] = [];
      for (let index = 0; index < 1024; index++) {
        initialSamples.push(
          generateSample(index, frequency, sampleRate, amplitude, currentWaveformType),
        );
      }
      samplesReference.current = new Float32Array(initialSamples);

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

        animationFrameReference.current = requestAnimationFrame(updateVisualization);
      };

      updateVisualization();
    } catch (error_) {
      console.error("Failed to start mock audio capture:", error_);
      setError(error_ instanceof Error ? error_ : new Error("Failed to start capture"));
      cleanup();
    }
  }, [
    cleanup,
    createNoiseSource,
    fftSize,
    smoothingTimeConstant,
    frequency,
    amplitude,
    sampleRate,
    currentWaveformType,
    waveformPoints,
    noiseLevel,
    recordingState,
    setFrequency,
  ]);

  const generateSample = (
    index: number,
    freq: number,
    sr: number,
    amp: number,
    type: WaveformType,
  ): number => {
    const t = index / sr;
    let sample = 0;

    switch (type) {
      case "sine": {
        sample = Math.sin(2 * Math.PI * freq * t);
        break;
      }
      case "square": {
        sample = Math.sin(2 * Math.PI * freq * t) >= 0 ? 1 : -1;
        break;
      }
      case "sawtooth": {
        sample = 2 * ((freq * t) % 1) - 1;
        break;
      }
      case "triangle": {
        sample = 4 * Math.abs(((freq * t) % 1) - 0.5) - 1;
        break;
      }
      case "noise": {
        sample = Math.random() * 2 - 1;
        break;
      }
    }

    return sample * amp;
  };

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
    if (analyserReference.current && audioContextReference.current) {
      const bufferLength = analyserReference.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserReference.current.getByteTimeDomainData(dataArray);
      samplesReference.current = new Float32Array(dataArray);
    }
    cleanup();
    setRecordingState("idle");
  }, [cleanup]);

  const discardCapture = useCallback(() => {
    collectedSamplesReference.current = new Float32Array();
    samplesReference.current = new Float32Array();
    cleanup();
    setRecordingState("idle");
    setVolumeLevel(0);
    setPeakLevel(0);
    setWaveformData([]);
    setDuration(0);
    setVpp(0);
    setFrequency(0);
  }, [cleanup, setFrequency]);

  const setAmplitude = useCallback((newAmplitude: number) => {
    setAmplitudeState(newAmplitude);
    if (gainReference.current && audioContextReference.current) {
      gainReference.current.gain.setValueAtTime(
        newAmplitude,
        audioContextReference.current.currentTime,
      );
    }
  }, []);

  const setWaveformType = useCallback((newType: WaveformType) => {
    setWaveformTypeState(newType);
    if (oscillatorReference.current && newType !== "noise") {
      oscillatorReference.current.type = newType;
    }
  }, []);

  return {
    recordingState,
    volumeLevel,
    peakLevel,
    waveformData,
    sampleRate,
    duration,
    samples: samplesReference.current,
    analysisFrame: samplesReference.current,
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
    setFrequency,
    setAmplitude,
    setWaveformType,
  };
}
