/**
 * DialogMicRecording - Recording Dialog
 * Popup for recording audio with start, pause, resume, stop, and save functionality
 *
 * Audio analysis logic is handled by useAudioAnalyzer hook.
 * Display preferences come from UI store for consistency.
 */

import * as React from "react";
import { Dialog, DialogFooter } from "../ui/dialog";
import {
  Mic,
  Pause,
  Play,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Save,
} from "lucide-react";
import { useToast } from "../ui/toast";
import { useMediaDevices, useStartRecording, useAudioAnalyzer, useUIStore, formatDuration } from "../../hooks";

// Waveform color mapping (matches settings page)
const WAVEFORM_COLORS: Record<string, string> = {
  cyan: "#06b6d4",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
};

// Map smoothWaveform boolean to smoothingTimeConstant
const SMOOTHING_VALUE = {
  smooth: 0.8,   // More smoothing
  normal: 0.3,   // Less smoothing
};

interface DialogMicRecordingProperties {
  isOpen: boolean;
  onClose: () => void;
  scopeId?: string;
  _scopeName?: string;
}

export function DialogMicRecording({
  isOpen,
  onClose,
  scopeId = "default",
  _scopeName,
}: DialogMicRecordingProperties): React.ReactElement {
  const { showToast } = useToast();
  const { devices, selectedDeviceId, setSelectedDeviceId, hasPermission, requestPermission } =
    useMediaDevices();
  const startRecordingMutation = useStartRecording();

  // UI Store - display preferences
  const { waveformColor, showGrid, smoothWaveform } = useUIStore();

  // Audio analyzer handles all audio capture and analysis logic
  // Passes smoothWaveform from store as smoothingTimeConstant
  const {
    recordingState,
    volumeLevel,
    peakLevel,
    waveformData,
    sampleRate,
    duration,
    samples,
    error,
    startCapture,
    pauseCapture,
    resumeCapture,
    stopCapture,
    discardCapture,
  } = useAudioAnalyzer({
    deviceId: selectedDeviceId,
    smoothingTimeConstant: smoothWaveform ? SMOOTHING_VALUE.smooth : SMOOTHING_VALUE.normal,
  });

  // Recording name state (UI only)
  const [recordingName, setRecordingName] = React.useState("");

  // Get input devices
  const inputDevices = devices.filter((d) => d.kind === "audioinput");

  // Status helpers (UI only)
  const getStatusLabel = () => {
    if (recordingState === "recording") return "Recording";
    if (recordingState === "paused") return "Paused";
    return "Preview";
  };
  const getStatusColor = () => {
    if (recordingState === "recording") return "bg-destructive animate-pulse";
    if (recordingState === "paused") return "bg-warning";
    return "bg-text-tertiary";
  };
  const getStatusText = () => {
    if (recordingState === "recording") return "Recording";
    if (recordingState === "paused") return "Paused";
    return "Ready";
  };
  const getVolumeColor = () => {
    if (volumeLevel > 0.8) return "linear-gradient(90deg, #22c55e 0%, #f59e0b 70%, #ef4444 100%)";
    if (volumeLevel > 0.5) return "linear-gradient(90deg, #22c55e 0%, #f59e0b 100%)";
    return "#22c55e";
  };

  // Generate default recording name (UI only)
  React.useEffect(() => {
    if (isOpen && !recordingName) {
      const now = new Date();
      const dateString = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const timeString = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      setRecordingName(`Recording ${dateString} ${timeString}`);
    }
  }, [isOpen, recordingName]);

  // Handle start capture with toast
  const handleStartCapture = async () => {
    if (error) {
      showToast({ message: error.message, type: "error" });
      return;
    }
    await startCapture();
    showToast({ message: "Recording started", type: "success" });
  };

  // Stop and save recording
  const stopAndSave = async () => {
    stopCapture();

    if (samples.length > 0 && scopeId) {
      try {
        await startRecordingMutation.mutateAsync({
          scopeId,
          name: recordingName || `Recording ${new Date().toLocaleString()}`,
        });
        showToast({ message: "Recording saved successfully!", type: "success" });
      } catch {
        showToast({ message: "Failed to save recording", type: "error" });
      }
    }
  };

  // Discard recording with toast
  const handleDiscard = () => {
    discardCapture();
    showToast({ message: "Recording discarded", type: "warning" });
  };

  // Request permission on open
  React.useEffect(() => {
    if (isOpen && !hasPermission) {
      requestPermission();
    }
  }, [isOpen, hasPermission, requestPermission]);

  // Cleanup on close
  React.useEffect(() => {
    if (!isOpen) {
      discardCapture();
    }
  }, [isOpen, discardCapture]);

  const handleClose = () => {
    if (recordingState === "idle") {
      onClose();
    } else {
      if (confirm("You have an active recording. Do you want to discard it?")) {
        handleDiscard();
        onClose();
      }
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Record Audio" maxWidth="max-w-[500px]">
      <div className="space-y-5">
        {/* Permission Status */}
        <div className="flex items-center gap-3 p-4 bg-bg-elevated rounded-lg border border-border-subtle">
          <div
            className={`w-9 h-9 flex items-center justify-center rounded-md ${
              hasPermission ? "bg-success/10" : "bg-destructive/10"
            }`}
          >
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
            <label className="block text-sm font-medium text-foreground mb-2">Recording Name</label>
            <input
              type="text"
              value={recordingName}
              onChange={(event_) => setRecordingName(event_.target.value)}
              placeholder="Enter recording name"
              className="w-full px-4 py-2.5 bg-bg-primary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
        )}

        {/* Device Selector */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Input Device</label>
          <div className="relative">
            <select
              value={selectedDeviceId || ""}
              onChange={(event_) => setSelectedDeviceId(event_.target.value || undefined)}
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
              {getStatusLabel()}
            </span>
            <div className="flex items-center gap-3">
              {recordingState !== "idle" && (
                <span className="text-lg font-mono font-bold text-accent">
                  {formatDuration(duration)}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs">
                <span className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                {getStatusText()}
              </span>
            </div>
          </div>

          {/* Waveform Display */}
          <div className="h-[100px] bg-bg-elevated rounded-md overflow-hidden relative">
            {/* Grid - controlled by showGrid from store */}
            {showGrid && (
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
            )}
            {/* Center line */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
            {/* Recording indicator for paused state */}
            {recordingState === "paused" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Pause size={32} className="text-warning" />
              </div>
            )}
            {/* Waveform - color from store */}
            {waveformData.length > 0 && (
              <svg
                className="absolute inset-2 w-full h-full"
                viewBox="0 0 64 20"
                preserveAspectRatio="none"
              >
                <path
                  d={`M ${waveformData.map((v, index) => `${index * (64 / waveformData.length)},${10 - v * 8}`).join(" L ")}`}
                  fill="none"
                  stroke={WAVEFORM_COLORS[waveformColor] || WAVEFORM_COLORS.cyan}
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
                background: getVolumeColor(),
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
              {recordingState === "idle" ? 0 : Math.round(samples.length / 10)}
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
              onClick={handleStartCapture}
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
              onClick={handleDiscard}
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
