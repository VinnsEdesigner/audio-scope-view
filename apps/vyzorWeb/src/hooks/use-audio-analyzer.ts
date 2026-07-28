

import { useCallback, useRef, useState } from "react";
import {
 normalizeAudioData,
 calculateRMS,
 calculatePeak,
 downsampleWaveform,
 collectSamples,
} from "@audio-scope-view/api-client/domain/_shared/audio-utils";

export type RecordingState = "idle" | "recording" | "paused";

export interface UseAudioAnalyzerOptions {
 deviceId?: string;
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
}

export interface UseAudioAnalyzerReturn extends AudioAnalyzerState {
 startCapture: () => Promise<void>;
 pauseCapture: () => void;
 resumeCapture: () => void;
 stopCapture: () => void;
 discardCapture: () => void;
 isCapturing: boolean;
 error: Error | null;
}

const DEFAULT_FFT_SIZE = 4096;
const DEFAULT_SMOOTHING = 0.3;
const DEFAULT_WAVEFORM_POINTS = 64;
const DEFAULT_SAMPLE_INTERVAL = 16;

export function useAudioAnalyzer(
 options: UseAudioAnalyzerOptions = {}
): UseAudioAnalyzerReturn {
 const {
 deviceId,
 fftSize = DEFAULT_FFT_SIZE,
 smoothingTimeConstant = DEFAULT_SMOOTHING,
 waveformPoints = DEFAULT_WAVEFORM_POINTS,
 sampleCollectionInterval = DEFAULT_SAMPLE_INTERVAL,
 } = options;

 
 const [recordingState, setRecordingState] = useState<RecordingState>("idle");
 const [volumeLevel, setVolumeLevel] = useState(0);
 const [peakLevel, setPeakLevel] = useState(0);
 const [waveformData, setWaveformData] = useState<number[]>([]);
 const [sampleRate, setSampleRate] = useState(44100);
 const [duration, setDuration] = useState(0);
 const [samples, setSamples] = useState<Float32Array>(new Float32Array());
 const [error, setError] = useState<Error | null>(null);

 
 const audioContextRef = useRef<AudioContext | undefined>(undefined);
 const analyserRef = useRef<AnalyserNode | undefined>(undefined);
 const mediaStreamRef = useRef<MediaStream | undefined>(undefined);
 const animationFrameRef = useRef<number | undefined>(undefined);
 const durationIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
 const collectedSamplesRef = useRef<Float32Array>(new Float32Array());

 const isCapturing = recordingState !== "idle";

 const cleanup = useCallback(() => {
 
 if (animationFrameRef.current) {
 cancelAnimationFrame(animationFrameRef.current);
 animationFrameRef.current = undefined;
 }

 
 if (durationIntervalRef.current) {
 clearInterval(durationIntervalRef.current);
 durationIntervalRef.current = undefined;
 }

 
 if (mediaStreamRef.current) {
 mediaStreamRef.current.getTracks().forEach((track) => track.stop());
 mediaStreamRef.current = undefined;
 }

 
 if (audioContextRef.current) {
 audioContextRef.current.close();
 audioContextRef.current = undefined;
 }

 analyserRef.current = undefined;
 }, []);

 const startCapture = useCallback(async () => {
 try {
 setError(null);
 cleanup();

 
 const stream = await navigator.mediaDevices.getUserMedia({
 audio: {
 deviceId: deviceId ? { exact: deviceId } : undefined,
 echoCancellation: false,
 noiseSuppression: false,
 autoGainControl: false,
 },
 });

 
 const audioContext = new AudioContext();
 const source = audioContext.createMediaStreamSource(stream);
 const analyser = audioContext.createAnalyser();

 analyser.fftSize = fftSize;
 analyser.smoothingTimeConstant = smoothingTimeConstant;
 source.connect(analyser);

 
 mediaStreamRef.current = stream;
 audioContextRef.current = audioContext;
 analyserRef.current = analyser;
 setSampleRate(audioContext.sampleRate);

 
 collectedSamplesRef.current = new Float32Array();

 
 setDuration(0);
 durationIntervalRef.current = setInterval(() => {
 setDuration((d) => d + 100);
 }, 100);

 setRecordingState("recording");

 
 const bufferLength = analyser.frequencyBinCount;
 const dataArray = new Uint8Array(bufferLength);

 const updateVisualization = () => {
 if (!analyserRef.current || recordingState !== "recording") {
 return;
 }

 analyserRef.current.getByteTimeDomainData(dataArray);

 
 const normalizedData = normalizeAudioData(dataArray);

 
 const rms = calculateRMS(normalizedData);
 const peak = calculatePeak(normalizedData);

 
 setVolumeLevel(Math.min(rms * 3, 1));
 setPeakLevel(Math.min(peak, 1));

 
 const waveform = downsampleWaveform(normalizedData, waveformPoints);
 setWaveformData(waveform);

 
 const collected = collectSamples(dataArray, sampleCollectionInterval);
 const currentSamples = collectedSamplesRef.current;
 collectedSamplesRef.current = new Float32Array(
 currentSamples.length + collected.length
 );
 collectedSamplesRef.current.set(currentSamples);
 collectedSamplesRef.current.set(collected, currentSamples.length);

 
 animationFrameRef.current = requestAnimationFrame(updateVisualization);
 };

 updateVisualization();
 } catch (err) {
 console.error("Failed to start audio capture:", err);
 setError(err instanceof Error ? err : new Error("Failed to start capture"));
 cleanup();
 }
 }, [deviceId, fftSize, smoothingTimeConstant, waveformPoints, sampleCollectionInterval, cleanup, recordingState]);

 const pauseCapture = useCallback(() => {
 if (durationIntervalRef.current) {
 clearInterval(durationIntervalRef.current);
 durationIntervalRef.current = undefined;
 }
 setRecordingState("paused");
 }, []);

 const resumeCapture = useCallback(() => {
 durationIntervalRef.current = setInterval(() => {
 setDuration((d) => d + 100);
 }, 100);
 setRecordingState("recording");
 }, []);

 const stopCapture = useCallback(() => {
 setSamples(collectedSamplesRef.current);
 cleanup();
 setRecordingState("idle");
 }, [cleanup]);

 const discardCapture = useCallback(() => {
 collectedSamplesRef.current = new Float32Array();
 setSamples(new Float32Array());
 cleanup();
 setRecordingState("idle");
 setVolumeLevel(0);
 setPeakLevel(0);
 setWaveformData([]);
 setDuration(0);
 }, [cleanup]);

 return {
 
 recordingState,
 volumeLevel,
 peakLevel,
 waveformData,
 sampleRate,
 duration,
 samples,
 isCapturing,
 error,
 
 startCapture,
 pauseCapture,
 resumeCapture,
 stopCapture,
 discardCapture,
 };
}
