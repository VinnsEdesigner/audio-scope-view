/**
 * DialogMicRecording - Test Microphone Dialog
 * Popup that shows microphone input with live waveform preview
 */

import * as React from "react";
import { Dialog, DialogFooter } from "../ui/dialog";
import { 
  Mic, 
  MicOff, 
  Square, 
  CheckCircle2, 
  AlertCircle,
  ChevronDown 
} from "lucide-react";
import { useMediaDevices } from "../../hooks";

interface DialogMicRecordingProperties {
  isOpen: boolean;
  onClose: () => void;
}

export function DialogMicRecording({
  isOpen,
  onClose,
}: DialogMicRecordingProperties): React.ReactElement {
  const { devices, selectedDeviceId, setSelectedDeviceId, hasPermission, requestPermission } = useMediaDevices();
  const [isListening, setIsListening] = React.useState(false);
  const [volumeLevel, setVolumeLevel] = React.useState(0);
  const [waveformData, setWaveformData] = React.useState<number[]>([]);
  
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);

  // Get input devices
  const inputDevices = devices.filter(d => d.kind === "audioinput");

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Start audio capture
  const startCapture = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          sampleRate: 48000,
        },
      });

      const audioContext = new AudioContext({ sampleRate: 48000 });
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 2048;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      setIsListening(true);

      // Animation loop for waveform and volume
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const waveformArray: number[] = [];

      const updateVisualization = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteTimeDomainData(dataArray);
          
          // Calculate RMS volume
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            const value = (dataArray[i] - 128) / 128;
            sum += value * value;
          }
          const rms = Math.sqrt(sum / bufferLength);
          setVolumeLevel(Math.min(rms * 3, 1)); // Scale for better visualization

          // Get waveform for display
          const newWaveform: number[] = [];
          for (let i = 0; i < 50; i++) {
            const index = Math.floor((i / 50) * bufferLength);
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
    }
  }, [selectedDeviceId]);

  // Stop audio capture
  const stopCapture = React.useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsListening(false);
    setVolumeLevel(0);
    setWaveformData([]);
  }, []);

  // Request permission on mount
  React.useEffect(() => {
    if (isOpen && !hasPermission) {
      requestPermission();
    }
  }, [isOpen, hasPermission, requestPermission]);

  // Cleanup on unmount or close
  React.useEffect(() => {
    if (!isOpen) {
      stopCapture();
    }
    return () => stopCapture();
  }, [isOpen, stopCapture]);

  const handleStop = () => {
    stopCapture();
  };

  const handleClose = () => {
    stopCapture();
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Test Microphone"
      maxWidth="max-w-[440px]"
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
              {hasPermission ? "Your microphone is ready to use" : "Please allow microphone access in your browser settings"}
            </div>
          </div>
        </div>

        {/* Device Selector */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Input Device
          </label>
          <div className="relative">
            <select
              value={selectedDeviceId || ""}
              onChange={(e) => setSelectedDeviceId(e.target.value || null)}
              className="w-full px-4 py-2.5 pr-10 bg-bg-primary border border-border rounded-lg text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
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

        {/* Waveform Display */}
        <div className="bg-bg-primary rounded-lg border border-border-subtle p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              Live Preview
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${
                isListening ? "bg-success animate-pulse" : "bg-text-tertiary"
              }`} />
              {isListening ? "Listening" : "Idle"}
            </span>
          </div>
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
            {/* Waveform */}
            {waveformData.length > 0 && (
              <svg className="absolute inset-2 w-full h-full" viewBox="0 0 50 20" preserveAspectRatio="none">
                <path
                  d={`M ${waveformData.map((v, i) => `${i * (50 / waveformData.length)},${10 - v * 8}`).join(" L ")}`}
                  fill="none"
                  stroke="#fb7185"
                  strokeWidth="0.3"
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
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-bg-elevated rounded-lg">
            <div className="text-base font-semibold font-mono text-foreground">48.0</div>
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider">kHz</div>
          </div>
          <div className="text-center p-3 bg-bg-elevated rounded-lg">
            <div className="text-base font-semibold font-mono text-accent">
              {volumeLevel.toFixed(2)}
            </div>
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider">RMS</div>
          </div>
          <div className="text-center p-3 bg-bg-elevated rounded-lg">
            <div className="text-base font-semibold font-mono text-foreground">
              {(volumeLevel * 1.5).toFixed(2)}
            </div>
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Peak</div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <button
          onClick={handleClose}
          className="px-4 py-2.5 text-sm font-medium bg-bg-secondary border border-border text-foreground rounded-lg hover:bg-bg-hover transition-colors"
        >
          Close
        </button>
        {isListening ? (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors"
          >
            <Square size={14} />
            Stop Test
          </button>
        ) : (
          <button
            onClick={startCapture}
            disabled={!hasPermission}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-success text-white rounded-lg hover:bg-success/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mic size={14} />
            Start Test
          </button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
