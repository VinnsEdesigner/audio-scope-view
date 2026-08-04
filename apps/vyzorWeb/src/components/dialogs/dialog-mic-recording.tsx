import * as React from "react";
import { Dialog, DialogFooter } from "../ui/dialog";
import { SelectDialog } from "./select-dialog";
import { Spinner } from "../ui/spinner";
import { Mic, Pause, Play, Trash2, CheckCircle2, AlertCircle, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useMediaDevices,
  useCreateRecording,
  useAudioAnalyzer,
  useUIStore,
  useAudioStore,
  formatDuration,
  type WaveformColor,
} from "../../hooks";

const SMOOTHING_VALUE = {
  smooth: 0.8,
  normal: 0.3,
};

const WAVEFORM_COLORS: Record<WaveformColor, string> = {
  cyan: "#22d3ee",
  blue: "#3b82f6",
  purple: "#a855f7",
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
};

interface WaveformCanvasProperties {
  waveformData: number[];
  waveformColor: WaveformColor;
  glow: boolean;
  autoScale: boolean;
  invert: boolean;
}

function WaveformCanvas({
  waveformData,
  waveformColor,
  glow,
  autoScale,
  invert,
}: WaveformCanvasProperties): React.ReactElement {
  const canvasReference = React.useRef<HTMLCanvasElement>(null);
  const containerReference = React.useRef<HTMLDivElement>(null);

  const waveformDataReference = React.useRef(waveformData);
  React.useEffect(() => {
    waveformDataReference.current = waveformData;
  }, [waveformData]);

  const settingsReference = React.useRef({ waveformColor, glow, autoScale, invert });
  React.useEffect(() => {
    settingsReference.current = { waveformColor, glow, autoScale, invert };
  }, [waveformColor, glow, autoScale, invert]);

  React.useEffect(() => {
    const canvas = canvasReference.current;
    const container = containerReference.current;
    if (!canvas || !container) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrameId: number;

    const draw = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        context.scale(dpr, dpr);
      }

      context.clearRect(0, 0, width, height);

      const waveformData = waveformDataReference.current;
      const { waveformColor, glow, autoScale, invert } = settingsReference.current;
      const color = WAVEFORM_COLORS[waveformColor] || WAVEFORM_COLORS.cyan;

      if (waveformData.length > 0) {
        const centerY = height / 2;

        let scale = 1;
        if (autoScale) {
          const maxValue = Math.max(...waveformData.map((v) => Math.abs(v)), 0.01);
          scale = (centerY * 0.8) / maxValue;
        }

        context.save();

        if (glow) {
          context.shadowColor = color;
          context.shadowBlur = 8;
        }

        if (invert) {
          context.scale(1, -1);
          context.translate(0, -height);
        }

        context.beginPath();
        context.strokeStyle = color;
        context.lineWidth = 1.5;
        context.lineJoin = "round";
        context.lineCap = "round";

        for (let index = 0; index < waveformData.length; index++) {
          const x = (index / (waveformData.length - 1)) * width;
          const y = centerY + waveformData[index] * scale;

          if (index === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }

        context.stroke();
        context.restore();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  React.useEffect(() => {
    const container = containerReference.current;
    const canvas = canvasReference.current;
    if (!container || !canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerReference} className="absolute inset-0">
      <canvas ref={canvasReference} className="w-full h-full" />
    </div>
  );
}

interface DialogMicRecordingProperties {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  _scopeName?: string;
}

export function DialogMicRecording({
  isOpen,
  onClose,
  sessionId,
  _scopeName,
}: DialogMicRecordingProperties): React.ReactElement {
  const { showToast } = useToast();
  const { devices, selectedDeviceId, setSelectedDeviceId, hasPermission, requestPermission } =
    useMediaDevices();
  const [createRecording] = useCreateRecording();
  const globalSampleRate = useAudioStore((state) => state.sampleRate);

  const { waveformColor, showGrid, smoothWaveform, glow, autoScale, invert } = useUIStore();

  const {
    recordingState,
    volumeLevel,
    peakLevel,
    waveformData,
    sampleRate: _localSampleRate,
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

  const [recordingName, setRecordingName] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const wasOpenReference = React.useRef(false);

  // Session is passed explicitly from parent
  const activeSessionId = sessionId;

  // Effects for permission and cleanup - must be called unconditionally
  React.useEffect(() => {
    if (isOpen && !hasPermission) {
      requestPermission();
    }
  }, [isOpen, hasPermission, requestPermission]);

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

  React.useEffect(() => {
    if (wasOpenReference.current && !isOpen) {
      discardCapture();
    }
    wasOpenReference.current = isOpen;
  }, [isOpen, discardCapture]);

  // Don't render anything if no sessionId is provided
  // Parent should handle session selection before opening this dialog
  if (!sessionId) {
    return <></>;
  }

  const inputDevices = Array.isArray(devices) ? devices.filter((d) => d.kind === "audioinput") : [];

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

  const handleStartCapture = async () => {
    if (error) {
      showToast({ message: error.message, type: "error" });
      return;
    }
    await startCapture();
    showToast({ message: "Recording started", type: "success" });
  };

  const stopAndSave = async () => {
    if (!activeSessionId) {
      showToast({ message: "No active session — please try again", type: "warning" });
      return;
    }

    const captured = stopCapture();

    if (captured.length > 0) {
      setIsSaving(true);
      try {
        await createRecording({
          variables: {
            input: {
              sessionId: activeSessionId,
              name: recordingName || `Recording ${new Date().toLocaleString()}`,
              samples: [...captured],
              sampleRate: globalSampleRate,
            },
          },
        });
        showToast({ message: "Recording saved successfully!", type: "success" });
        onClose();
      } catch {
        showToast({ message: "Failed to save recording", type: "error" });
      } finally {
        setIsSaving(false);
      }
    } else {
      showToast({ message: "Nothing captured — recording not saved", type: "warning" });
    }
  };

  const handleDiscard = () => {
    discardCapture();
    showToast({ message: "Recording discarded", type: "warning" });
  };

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
        {}
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

        {}
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

        {}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Input Device</label>
          <SelectDialog
            value={selectedDeviceId ?? ""}
            options={inputDevices.map((device) => ({
              value: device.deviceId,
              label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
            }))}
            placeholder={inputDevices.length > 0 ? "Select device" : "No devices found"}
            onChange={(value) => setSelectedDeviceId(String(value) || undefined)}
            triggerLabel="Input Device"
            disabled={recordingState !== "idle"}
          />
        </div>

        {}
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

          {}
          <div className="h-[100px] bg-bg-elevated rounded-md overflow-hidden relative">
            {}
            {showGrid && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `
 linear-gradient(rgba(120, 160, 170, 0.15) 1px, transparent 1px),
 linear-gradient(90deg, rgba(120, 160, 170, 0.15) 1px, transparent 1px)
 `,
                  backgroundSize: "10% 12.5%",
                }}
              />
            )}
            {}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
            {}
            {recordingState === "paused" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play size={32} className="text-warning" />
              </div>
            )}
            {}
            <WaveformCanvas
              waveformData={waveformData}
              waveformColor={waveformColor}
              glow={glow}
              autoScale={autoScale}
              invert={invert}
            />
          </div>
        </div>

        {}
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

        {}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 bg-bg-elevated rounded-lg">
            <div className="text-sm font-semibold font-mono text-foreground">
              {(globalSampleRate / 1000).toFixed(1)}
            </div>
            <div className="text-[10px] text-text-tertiary uppercase">kHz</div>
          </div>
          <div className="text-center p-2 bg-bg-elevated rounded-lg">
            <div className="text-sm font-semibold font-mono text-foreground">
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
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2"
            >
              Cancel
            </button>
            <button
              onClick={handleStartCapture}
              disabled={!hasPermission}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2 flex-1"
            >
              <Mic size={16} />
              Start Recording
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleDiscard}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2"
            >
              <Trash2 size={16} />
              Discard
            </button>
            <div className="flex-1 flex gap-2">
              {recordingState === "recording" ? (
                <button
                  onClick={pauseCapture}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2 flex-1"
                >
                  <Pause size={16} />
                  Pause
                </button>
              ) : (
                <button
                  onClick={resumeCapture}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2 flex-1"
                >
                  <Play size={16} />
                  Resume
                </button>
              )}
              <button
                onClick={stopAndSave}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2"
              >
                {isSaving ? <Spinner size={16} /> : <Save size={16} />}
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
