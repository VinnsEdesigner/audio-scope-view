import * as React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  useAudioAnalyzer,
  useAudioSettings,
  useMockAudioAnalyzer,
  useRecording,
  useSessionDialogs,
  useToast,
} from "@/hooks";
import { useUIStore } from "@/store";
import { ScopeTopBar, ScopeSidebar, ScopeBottomControls, ScopeCanvas } from "@/components/scope";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import type { Recording } from "@/hooks";

export function ScopePage(): React.ReactElement {
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const recordingId = searchParameters.get("recording") ?? undefined;
  const isPlaybackMode = Boolean(recordingId);

  // Set scope mode in store
  const { setSessionMode, testMode, toggleTestMode, smoothWaveform } = useUIStore();

  React.useEffect(() => {
    setSessionMode(isPlaybackMode ? "playback" : "live");
    return () => setSessionMode("live");
  }, [isPlaybackMode, setSessionMode]);

  // Smoothing values for waveform
  const SMOOTHING = {
    smooth: 0.8,
    normal: 0.3,
  };
  const smoothingTimeConstant = smoothWaveform ? SMOOTHING.smooth : SMOOTHING.normal;

  // Audio settings
  const { sampleRate, bufferSize } = useAudioSettings();

  // Both analyzers - we use one based on testMode
  const realAnalyzer = useAudioAnalyzer({
    desiredSampleRate: sampleRate,
    smoothingTimeConstant,
    fftSize: bufferSize,
  });
  const mockAnalyzer = useMockAudioAnalyzer({
    sampleRate,
    smoothingTimeConstant,
    fftSize: bufferSize,
  });
  const audioAnalyzer = testMode ? mockAnalyzer : realAnalyzer;

  // PLAYBACK mode hooks
  const {
    data: recordingData,
    isLoading: recordingLoading,
    error: recordingError,
  } = useRecording(recordingId);

  // Recording for dialogs
  const recordingForDialogs: Recording | undefined = recordingData
    ? {
        id: recordingData.id,
        name: recordingData.name,
        duration: recordingData.durationMs,
        createdAt: recordingData.timestamp.toISOString(),
        size: recordingData.sizeBytes,
      }
    : undefined;

  // Canvas ref for export dialog
  const canvasReference = React.useRef<HTMLCanvasElement | null>(null);

  // Dialogs hook - handles all dialog state management
  const { handlers: dialogHandlers, Dialogs } = useSessionDialogs({
    mode: isPlaybackMode ? "playback" : "live",
    recording: recordingForDialogs,
    recordingId,
    canvasRef: canvasReference,
  });

  // Playback state
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentPlaybackTime, setCurrentPlaybackTime] = React.useState(0);
  const [playbackSpeed, setPlaybackSpeed] = React.useState(1);
  const [loopPlayback, setLoopPlayback] = React.useState(false);
  const animationFrameReference = React.useRef<number | undefined>(undefined);
  const lastTimestampReference = React.useRef<number | undefined>(undefined);

  // Playback animation loop using requestAnimationFrame
  React.useEffect(() => {
    if (!isPlaybackMode || !isPlaying || !recordingData) {
      if (animationFrameReference.current !== undefined) {
        cancelAnimationFrame(animationFrameReference.current);
        animationFrameReference.current = undefined;
      }
      return;
    }

    const durationMs = recordingData.durationMs;

    const animate = (timestamp: number) => {
      if (lastTimestampReference.current === undefined) {
        lastTimestampReference.current = timestamp;
      }

      const deltaMs = timestamp - lastTimestampReference.current;
      lastTimestampReference.current = timestamp;

      setCurrentPlaybackTime((previousTime) => {
        let newTime = previousTime + deltaMs * playbackSpeed;

        if (newTime >= durationMs) {
          if (loopPlayback) {
            newTime = newTime % durationMs;
          } else {
            setIsPlaying(false);
            return durationMs;
          }
        }

        return newTime;
      });

      animationFrameReference.current = requestAnimationFrame(animate);
    };

    lastTimestampReference.current = undefined;
    animationFrameReference.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameReference.current !== undefined) {
        cancelAnimationFrame(animationFrameReference.current);
        animationFrameReference.current = undefined;
      }
    };
  }, [isPlaybackMode, isPlaying, recordingData, playbackSpeed, loopPlayback]);

  // Calculate visible waveform data based on current playback time
  const playbackWaveformData = React.useMemo(() => {
    if (!isPlaybackMode || !recordingData?.samples || recordingData.samples.length === 0) {
      return [];
    }

    const samples = recordingData.samples;
    const sampleCount = recordingData.sampleCount;
    const durationMs = recordingData.durationMs;
    const timebase = 1024; // samples per window

    if (durationMs === 0 || sampleCount === 0) {
      return samples.slice(0, timebase);
    }

    // Calculate which sample index corresponds to currentPlaybackTime
    const samplesPerMs = sampleCount / durationMs;
    const currentSampleIndex = Math.floor(currentPlaybackTime * samplesPerMs);

    // Calculate the window of samples to show
    const halfWindow = Math.floor(timebase / 2);
    let startIndex = Math.max(0, currentSampleIndex - halfWindow);
    const endIndex = Math.min(sampleCount, startIndex + timebase);

    // Adjust start if we're near the end
    if (endIndex - startIndex < timebase) {
      startIndex = Math.max(0, endIndex - timebase);
    }

    return samples.slice(startIndex, endIndex);
  }, [isPlaybackMode, recordingData, currentPlaybackTime]);

  // Use playback waveform in playback mode, live waveform otherwise
  const waveformData = isPlaybackMode ? playbackWaveformData : audioAnalyzer.waveformData;

  const isCapturing = !isPlaybackMode && audioAnalyzer.isCapturing;
  const isPaused = !isPlaybackMode && audioAnalyzer.recordingState === "paused";

  // Scope info
  const scopeName = "Oscilloscope";
  const recordingName = recordingData?.name;

  // Loading state
  const isLoading = isPlaybackMode && recordingLoading;

  // Error state
  const error = isPlaybackMode ? recordingError : undefined;

  // Handle back navigation
  const handleBack = () => {
    // Stop playback when navigating away
    setIsPlaying(false);
    navigate("/");
  };

  // Handle playback play/pause
  const handlePlay = () => {
    if (!recordingData) return;
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentPlaybackTime(0);
  };

  const handleSeek = (time: number) => {
    setCurrentPlaybackTime(Math.max(0, Math.min(time, recordingData?.durationMs ?? 0)));
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
  };

  const handleLoopToggle = () => {
    setLoopPlayback((previous) => !previous);
  };

  // Toast for sidebar actions
  const handleOpenDisplaySettings = () => {
    dialogHandlers.onOpenDisplaySettings();
  };

  const handleOpenTriggerSettings = () => {
    if (isPlaybackMode) {
      showToast({ message: "Trigger is not available in playback mode", type: "info" });
    } else {
      dialogHandlers.onOpenTriggerSettings();
    }
  };

  const handleOpenMeasurements = () => {
    dialogHandlers.onOpenMeasurements();
  };

  const handleOpenExport = () => {
    dialogHandlers.onOpenExport();
  };

  const handleOpenRecordingInfo = () => {
    if (isPlaybackMode) {
      dialogHandlers.onOpenRecordingInfo();
    } else {
      showToast({ message: "Recording info is only available in playback mode", type: "info" });
    }
  };

  const handleRename = () => {
    if (isPlaybackMode) {
      dialogHandlers.onRename();
    } else {
      showToast({ message: "Rename is only available for recordings", type: "info" });
    }
  };

  const handleDelete = () => {
    if (isPlaybackMode) {
      dialogHandlers.onDelete();
    } else {
      showToast({ message: "Delete is only available for recordings", type: "info" });
    }
  };

  // Loading skeleton - matches actual layout structure
  if (isLoading) {
    return (
      <div className="flex w-full h-screen bg-bg-primary text-foreground overflow-hidden">
        {/* Left Sidebar: 5 nav items with icon + label placeholders */}
        <div className="w-[72px] bg-bg-secondary border-r border-border-subtle flex flex-col pt-16 pb-3 px-2 gap-1">
          {[1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="flex flex-col items-center gap-1 py-2.5 px-1.5">
              <Skeleton className="w-6 h-6 rounded" />
              <Skeleton className="w-8 h-2 rounded" />
            </div>
          ))}
          <div className="flex-1" />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar: Back button, scope name, recording name, sample rate, test mode toggle */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border-subtle">
            <Skeleton className="w-9 h-9 rounded-md" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-48" />
            <div className="flex-1" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="w-20 h-8 rounded-md" />
          </div>

          {/* Canvas Area: Dark background with centered spinner */}
          <div className="flex-1 relative bg-[#111820] min-h-0">
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner size={48} />
            </div>
          </div>

          {/* Bottom Controls: 4 measurement values + playback controls */}
          <div className="border-t border-border-subtle bg-bg-secondary">
            {/* 4 measurement value placeholders */}
            <div className="flex items-center justify-around px-4 py-3 border-b border-border-subtle">
              <div className="flex flex-col items-center">
                <Skeleton className="h-4 w-8 mb-1" />
                <Skeleton className="h-3 w-12" />
              </div>
              <div className="flex flex-col items-center">
                <Skeleton className="h-4 w-8 mb-1" />
                <Skeleton className="h-3 w-12" />
              </div>
              <div className="flex flex-col items-center">
                <Skeleton className="h-4 w-8 mb-1" />
                <Skeleton className="h-3 w-12" />
              </div>
              <div className="flex flex-col items-center">
                <Skeleton className="h-4 w-8 mb-1" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
            {/* Playback controls: play/pause/stop buttons, seek bar, speed selector, loop toggle */}
            <div className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <Skeleton className="w-16 h-8 rounded-md" />
              <Skeleton className="w-8 h-8 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error screen
  if (error) {
    return (
      <div className="flex w-full h-screen bg-bg-primary text-foreground">
        <div className="flex-1 flex flex-col">
          {/* Minimal top bar for error */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
            <button
              onClick={handleBack}
              className="p-2 rounded-md hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="text-sm font-medium">Error</span>
          </div>

          {/* Error message */}
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-red-400 text-2xl">!</span>
              </div>
              <p className="text-white font-medium">Failed to load recording</p>
              <p className="text-sm text-[#a1a1aa] max-w-md">
                {error instanceof Error ? error.message : "An unknown error occurred"}
              </p>
              <button
                onClick={handleBack}
                className="mt-4 px-4 py-2 bg-white text-[#09090b] rounded-md font-medium hover:bg-white/90 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main scope page UI (matches the mock exactly)
  return (
    <div className="flex w-full h-screen bg-bg-primary text-foreground overflow-hidden">
      {/* Left Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <ScopeSidebar
          onOpenDisplaySettings={handleOpenDisplaySettings}
          onOpenTriggerSettings={handleOpenTriggerSettings}
          onOpenMeasurements={handleOpenMeasurements}
          onOpenExport={handleOpenExport}
          onOpenRecordingInfo={handleOpenRecordingInfo}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <ScopeTopBar
          mode={isPlaybackMode ? "playback" : "live"}
          scopeName={scopeName}
          recordingName={recordingName}
          sampleRate={sampleRate}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          testMode={testMode}
          onToggleTestMode={toggleTestMode}
          onProbe={async () => {
            try {
              await audioAnalyzer.startCapture();
              showToast({ message: "Probe started - capturing audio", type: "success" });
            } catch {
              showToast({
                message: "Failed to start probe - check microphone permissions",
                type: "error",
              });
            }
          }}
          onPauseCapture={() => {
            audioAnalyzer.pauseCapture();
            showToast({ message: "Capture paused", type: "info" });
          }}
          onResumeCapture={() => {
            audioAnalyzer.resumeCapture();
            showToast({ message: "Capture resumed", type: "success" });
          }}
          onStopCapture={() => {
            audioAnalyzer.stopCapture();
            showToast({ message: "Capture stopped", type: "info" });
          }}
          mobileMenuItems={
            isPlaybackMode
              ? [
                  { id: "display", label: "Display", onClick: handleOpenDisplaySettings },
                  { id: "measure", label: "Measure", onClick: handleOpenMeasurements },
                  { id: "info", label: "Info", onClick: handleOpenRecordingInfo },
                  { id: "export", label: "Export", onClick: handleOpenExport },
                  { id: "rename", label: "Rename", onClick: handleRename },
                  { id: "delete", label: "Delete", onClick: handleDelete },
                ]
              : [
                  { id: "display", label: "Display", onClick: handleOpenDisplaySettings },
                  { id: "trigger", label: "Trigger", onClick: handleOpenTriggerSettings },
                  { id: "measure", label: "Measure", onClick: handleOpenMeasurements },
                  { id: "cal", label: "Cal", onClick: () => {} },
                  { id: "export", label: "Export", onClick: handleOpenExport },
                ]
          }
        />

        {/* Canvas Area */}
        <div className="flex-1 relative bg-[#111820] min-h-0">
          {/* The actual canvas - passes ref for export dialog */}
          <ScopeCanvas
            waveformData={waveformData}
            isCapturing={isCapturing}
            isPaused={isPaused}
            forwardedRef={canvasReference}
          />

          {/* Placeholder when no data */}
          {!isCapturing && waveformData.length === 0 && !isPlaybackMode && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#111820]/70">
              <p className="max-w-[300px] text-[14px] text-[#a1a1aa] text-center leading-relaxed">
                Press Probe to start capturing audio from your microphone.
              </p>
            </div>
          )}

          {/* No recording data placeholder */}
          {isPlaybackMode && waveformData.length === 0 && !recordingLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#111820]/70">
              <p className="max-w-[300px] text-[14px] text-[#a1a1aa] text-center leading-relaxed">
                No waveform data available for this recording.
              </p>
            </div>
          )}

          {/* Hold badge */}
          {(isCapturing || isPaused) && (
            <div className="absolute top-3 left-3 bg-white text-[#09090b] px-2 py-1 rounded text-[11px] font-semibold">
              HOLD
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <ScopeBottomControls
          mode={isPlaybackMode ? "playback" : "live"}
          vpp={recordingData?.peakAmplitude ?? audioAnalyzer.vpp}
          frequency={audioAnalyzer.frequency}
          windowMs={audioAnalyzer.windowMs}
          timebase={1024}
          verticalGain={1}
          duration={recordingData?.durationMs}
          currentTime={currentPlaybackTime}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          onSeek={handleSeek}
          playbackSpeed={playbackSpeed}
          onSpeedChange={handleSpeedChange}
          loopPlayback={loopPlayback}
          onLoopToggle={handleLoopToggle}
        />
      </div>

      {/* Dialogs */}
      <Dialogs />
    </div>
  );
}

export default ScopePage;
