/**
 * DialogMicRecording - Recording Dialog
 * Popup for recording audio with start, pause, resume, stop, and save functionality
 */

import * as React from "react";
import { Dialog, DialogFooter } from "../ui/dialog";
import { 
  Mic, 
  Square, 
  Pause, 
  Play, 
  Trash2,
  CheckCircle2, 
  AlertCircle,
  ChevronDown,
  Save,
  X
} from "lucide-react";
import { useToast } from "../ui/toast";
import { useMediaDevices, useStartRecording, useStopRecording, usePauseRecording, useResumeRecording } from "../../hooks";

interface DialogMicRecordingProperties {
  isOpen: boolean;
  onClose: () => void;
  scopeId?: string;
  scopeName?: string;
}

type RecordingState = "idle" | "recording" | "paused";

export function DialogMicRecording({
  isOpen,
  onClose,
  scopeId = "default",
  scopeName = "Default Scope",
}: DialogMicRecordingProperties): React.ReactElement {
  const { showToast } = useToast();
  const { devices, selectedDeviceId, setSelectedDeviceId, hasPermission, requestPermission } = useMediaDevices();
  
  // Recording state
  const [recordingState, setRecordingState] = React.useState<RecordingState>("idle");
  const [recordingName, setRecordingName] = React.useState("");
  const [duration, setDuration] = React.useState(0);
  const [samples, setSamples] = React.useState<number[]>([]);
  
  // Audio analysis state
  const [volumeLevel, setVolumeLevel] = React.useState(0);
  const [peakLevel, setPeakLevel] = React.useState(0);
  const [waveformData, setWaveformData] = React.useState<number[]>([]);
  const [sampleRate, setSampleRate] = React.useState(44100);
  
  // Refs
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const durationIntervalRef = React.useRef<number | null>(null);
  const audioDataRef = React.useRef<number[]>([]);

  // Recording mutations
  const startRecordingMutation = useStartRecording();
  const stopRecordingMutation = useStopRecording();
  const pauseRecordingMutation = usePauseRecording();
  const resumeRecordingMutation = useResumeRecording();

  // Get input devices
  const inputDevices = devices.filter(d => d.kind === "audioinput");

  // Generate default recording name
  React.useEffect(() => {
    if (isOpen && !recordingName) {
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      setRecordingName(`Recording ${dateStr} ${timeStr}`);
    }
  }, [isOpen, recordingName]);

  // Format duration as MM:SS
  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Start audio capture
  const startCapture = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      
      mediaStreamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      setSampleRate(audioContext.sampleRate);
      
      // Reset samples buffer
      audioDataRef.current = [];

      // Start duration timer
      setDuration(0);
      durationIntervalRef.current = window.setInterval(() => {
        setDuration(d => d + 100);
      }, 100);

      setRecordingState("recording");
      showToast({ message: "Recording started", type: "success" });

      // Animation loop for waveform and volume
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVisualization = () => {
        if (analyserRef.current && recordingState === "recording") {
          analyserRef.current.getByteTimeDomainData(dataArray);
          
          // Calculate RMS and peak
          let sum = 0;
          let peak = 0;
          for (let i = 0; i < bufferLength; i++) {
            const value = (dataArray[i] - 128) / 128;
            sum += value * value;
            const absValue = Math.abs(value);
            if (absValue > peak) peak = absValue;
            
            // Collect samples for saving (downsample)
            if (i % 16 === 0) {
              audioDataRef.current.push(value);
            }
          }
          const rms = Math.sqrt(sum / bufferLength);
          setVolumeLevel(Math.min(rms * 3, 1));
          setPeakLevel(Math.min(peak, 1));

          // Get waveform for display
          const newWaveform: number[] = [];
          for (let i = 0; i < 64; i++) {
            const index = Math.floor((i / 64) * bufferLength);
            const value = (dataArray[index] - 128) / 128;
            newWaveform.push(value);
          }
          setWaveformData(newWaveform);
        }
        animationFrameRef.current = requestAnimationFrame(updateVisualization);
      };

      updateVisualization();
    } catch (error) {
      console.error("Failed to start audio capture:", error);
      showToast({ message: "Failed to start recording. Please check microphone permissions.", type: "error" });
    }
  }, [selectedDeviceId, recordingState, showToast]);

  // Pause audio capture
  const pauseCapture = React.useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    setRecordingState("paused");
    showToast({ message: "Recording paused", type: "info" });
  }, [showToast]);

  // Resume audio capture
  const resumeCapture = React.useCallback(() => {
    durationIntervalRef.current = window.setInterval(() => {
      setDuration(d => d + 100);
    }, 100);
    setRecordingState("recording");
    showToast({ message: "Recording resumed", type: "success" });
  }, [showToast]);

  // Stop and save recording
  const stopAndSave = React.useCallback(async () => {
    // Stop all intervals and audio
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    analyserRef.current = null;

    // Save to backend
    const finalSamples = [...audioDataRef.current];
    if (finalSamples.length > 0 && scopeId) {
      try {
        await startRecordingMutation.mutateAsync({
          scopeId,
          name: recordingName || `Recording ${new Date().toLocaleString()}`,
        });
        showToast({ message: "Recording saved successfully!", type: "success" });
      } catch (error) {
        console.error("Failed to save recording:", error);
        showToast({ message: "Failed to save recording", type: "error" });
      }
    }

    // Reset state
    setRecordingState("idle");
    setDuration(0);
    setSamples([]);
    setVolumeLevel(0);
    setPeakLevel(0);
    setWaveformData([]);
    audioDataRef.current = [];
  }, [scopeId, recordingName, startRecordingMutation, showToast]);

  // Discard recording
  const discardRecording = React.useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    analyserRef.current = null;

    setRecordingState("idle");
    setDuration(0);
    setSamples([]);
    setVolumeLevel(0);
    setPeakLevel(0);
    setWaveformData([]);
    audioDataRef.current = [];
    
    showToast({ message: "Recording discarded", type: "warning" });
  }, [showToast]);

  // Request permission on mount
  React.useEffect(() => {
    if (isOpen && !hasPermission) {
      requestPermission();
    }
  }, [isOpen, hasPermission, requestPermission]);

  // Cleanup on unmount or close
  React.useEffect(() => {
    if (!isOpen) {
      discardRecording();
    }
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(track => track.stop());
    };
  }, [isOpen, discardRecording]);

  const handleClose = () => {
    if (recordingState !== "idle") {
      if (confirm("You have an active recording. Do you want to discard it?")) {
        discardRecording();
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Record Audio"
      maxWidth="max-w-[500px]"
    >
      <div className="space-y-5">
        {/* Permission Status */}
        <div className="flex items-center gap-3 p-4 bg-bg-elevated rounded-lg border border-border-subtle">
          <div className={`w-9 h-9 flex items-center justify-center rounded-md ${
            hasPermission ? "bg-success/10" : "bg-destructive/10"
          }`}>
            {hasPermission ? (
              <CheckCircle2 size={18} className="text-success" />
            ) : (
              <AlertCircle size={18} className="text-destructive" />
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">
              {hasPermission ? "Microphone access granted" : "Microphone access denied"}
            </div>
            <div className="text-xs text-text-tertiary">
              {hasPermission ? "Ready to record" : "Please allow microphone access"}
            </div>
          </div>
        </div>

        {/* Recording Name Input */}
        {recordingState === "idle" && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Recording Name
            </label>
            <input
              type="text"
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              placeholder="Enter recording name"
              className="w-full px-4 py-2.5 bg-bg-primary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
        )}

        {/* Device Selector */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Input Device
          </label>
          <div className="relative">
            <select
              value={selectedDeviceId || ""}
              onChange={(e) => setSelectedDeviceId(e.target.value || null)}
              disabled={recordingState !== "idle"}
              className="w-full px-4 py-2.5 pr-10 bg-bg-primary border border-border rounded-lg text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inputDevices.length === 0 ? (
                <option value="">No devices found</option>
              ) : (
                inputDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
          </div>
        </div>

        {/* Recording Status */}
        <div className="bg-bg-primary rounded-lg border border-border-subtle p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              {recordingState === "idle" ? "Preview" : recordingState === "recording" ? "Recording" : "Paused"}
            </span>
            <div className="flex items-center gap-3">
              {recordingState !== "idle" && (
                <span className="text-lg font-mono font-bold text-accent">
                  {formatDuration(duration)}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs">
                <span className={`w-2 h-2 rounded-full ${
                  recordingState === "recording" ? "bg-destructive animate-pulse" :
                  recordingState === "paused" ? "bg-warning" : "bg-text-tertiary"
                }`} />
                {recordingState === "recording" ? "Recording" :
                 recordingState === "paused" ? "Paused" : "Ready"}
              </span>
            </div>
          </div>
          
          {/* Waveform Display */}
          <div className="h-[100px] bg-bg-elevated rounded-md overflow-hidden relative">
            {/* Grid */}
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px),
                  linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)
                `,
                backgroundSize: "20px 20px",
              }}
            />
            {/* Center line */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
            {/* Recording indicator for paused state */}
            {recordingState === "paused" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Pause size={32} className="text-warning" />
              </div>
            )}
            {/* Waveform */}
            {waveformData.length > 0 && (
              <svg className="absolute inset-2 w-full h-full" viewBox="0 0 64 20" preserveAspectRatio="none">
                <path
                  d={`M ${waveformData.map((v, i) => `${i * (64 / waveformData.length)},${10 - v * 8}`).join(" L ")}`}
                  fill="none"
                  stroke={recordingState === "recording" ? "#ef4444" : "#fb923c"}
                  strokeWidth="0.4"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
        </div>

        {/* Volume Meter */}
        <div>
          <div className="flex justify-between text-xs text-text-tertiary mb-2">
            <span>Input Level</span>
            <span>{Math.round(volumeLevel * 100)}%</span>
          </div>
          <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-75"
              style={{
                width: `${volumeLevel * 100}%`,
                background: volumeLevel > 0.8 
                  ? "linear-gradient(90deg, #22c55e 0%, #f59e0b 70%, #ef4444 100%)"
                  : volumeLevel > 0.5
                  ? "linear-gradient(90deg, #22c55e 0%, #f59e0b 100%)"
                  : "#22c55e"
              }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 bg-bg-elevated rounded-lg">
            <div className="text-sm font-semibold font-mono text-foreground">
              {(sampleRate / 1000).toFixed(1)}
            </div>
            <div className="text-[10px] text-text-tertiary uppercase">kHz</div>
          </div>
          <div className="text-center p-2 bg-bg-elevated rounded-lg">
            <div className="text-sm font-semibold font-mono text-accent">
              {volumeLevel.toFixed(2)}
            </div>
            <div className="text-[10px] text-text-tertiary uppercase">RMS</div>
          </div>
          <div className="text-center p-2 bg-bg-elevated rounded-lg">
            <div className="text-sm font-semibold font-mono text-foreground">
              {peakLevel.toFixed(2)}
            </div>
            <div className="text-[10px] text-text-tertiary uppercase">Peak</div>
          </div>
          <div className="text-center p-2 bg-bg-elevated rounded-lg">
            <div className="text-sm font-semibold font-mono text-foreground">
              {recordingState !== "idle" ? Math.round(samples.length / 10) : 0}
            </div>
            <div className="text-[10px] text-text-tertiary uppercase">KB</div>
          </div>
        </div>
      </div>

      <DialogFooter className="flex gap-2">
        {recordingState === "idle" ? (
          <>
            <button
              onClick={handleClose}
              className="px-4 py-2.5 text-sm font-medium bg-bg-secondary border border-border text-foreground rounded-lg hover:bg-bg-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={startCapture}
              disabled={!hasPermission}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Mic size={16} />
              Start Recording
            </button>
          </>
        ) : (
          <>
            <button
              onClick={discardRecording}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
              Discard
            </button>
            <div className="flex-1 flex gap-2">
              {recordingState === "recording" ? (
                <button
                  onClick={pauseCapture}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-warning text-white rounded-lg hover:bg-warning/90 transition-colors"
                >
                  <Pause size={16} />
                  Pause
                </button>
              ) : (
                <button
                  onClick={resumeCapture}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-success text-white rounded-lg hover:bg-success/90 transition-colors"
                >
                  <Play size={16} />
                  Resume
                </button>
              )}
              <button
                onClick={stopAndSave}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
              >
                <Save size={16} />
                Save
              </button>
            </div>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
