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
  useStreamingPlayback,
  useScopeCapture,
  useHomePageSessions,
  useLastUsedSession,
  type ScopeCaptureDspMetrics,
  type AnalysisUpdate,
} from "@/hooks";
import { useUIStore } from "@/store";
import { ScopeTopBar, ScopeSidebar, ScopeBottomControls, ScopeCanvas } from "@/components/scope";
import { CalibrationDialog } from "@/components/dialogs";
import { AnchoredDialog } from "@/components/ui/anchored-dialog";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import type { Recording } from "@/hooks";

const STREAMING_THRESHOLD_SAMPLES = 500_000;

const STREAMING_THRESHOLD_BYTES = 400 * 1024;

export function ScopePage(): React.ReactElement {
  const [searchParameters, setSearchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const recordingId = searchParameters.get("recording") ?? undefined;
  const sessionId = searchParameters.get("sessionId") ?? undefined;
  const isPlaybackMode = Boolean(recordingId);
  const isLiveMode = Boolean(sessionId);

  const { setSessionMode, testMode, toggleTestMode, smoothWaveform } = useUIStore();

  // Session selection state - these are now handled by SessionSelectionProvider on home page

  const { sessions, loading: sessionsLoading } = useHomePageSessions();
  const { shouldAutoSelect, lastUsedSession, markSessionAsUsed, isLoadingSession } =
    useLastUsedSession();

  // Combined loading state - wait for both session queries before making navigation decisions
  const isLoadingSessionData = sessionsLoading || isLoadingSession;

  const [serverAnalysis, setServerAnalysis] = React.useState<AnalysisUpdate | undefined>();

  const handleAnalysisUpdate = React.useCallback((data: AnalysisUpdate) => {
    setServerAnalysis(data);

    console.debug("Server analysis:", data);
  }, []);

  const scopeCapture = useScopeCapture({
    sessionId: sessionId ?? "",
    onAnalysisUpdate: handleAnalysisUpdate,
  });

  React.useEffect(() => {
    setSessionMode(isPlaybackMode ? "playback" : "live");
    return () => setSessionMode("live");
  }, [isPlaybackMode, setSessionMode]);

  // Handle session selection when navigating to oscilloscope without sessionId or with invalid sessionId
  React.useEffect(() => {
    // Only handle when we're trying to use live mode (not playback)
    if (!isPlaybackMode) {
      // Skip if still loading data - prevent race condition
      if (isLoadingSessionData) {
        return;
      }

      // Check if sessionId is valid (exists in sessions list)
      const sessionExists = sessionId
        ? sessions.some((s: { id: string }) => s.id === sessionId)
        : false;

      if (!sessionId || !sessionExists) {
        // No sessionId or session doesn't exist
        if (shouldAutoSelect && lastUsedSession) {
          // Auto-select: update URL with last used session
          setSearchParameters({ sessionId: lastUsedSession.id });
        } else {
          // Auto-select disabled or no sessions available
          // Redirect to home - let SessionSelectionProvider handle showing the dialog
          // This prevents the "flash" of oscilloscope UI before dialog appears
          navigate("/");
        }
      }
    }
  }, [
    isPlaybackMode,
    sessionId,
    sessions,
    shouldAutoSelect,
    lastUsedSession,
    isLoadingSessionData,
    setSearchParameters,
    navigate,
  ]);

  const _handleSessionSelect = React.useCallback(
    async (selectedSessionId: string) => {
      await markSessionAsUsed(selectedSessionId);
      setSearchParameters({ sessionId: selectedSessionId });
    },
    [markSessionAsUsed, setSearchParameters],
  );

  const SMOOTHING = {
    smooth: 0.8,
    normal: 0.3,
  };
  const smoothingTimeConstant = smoothWaveform ? SMOOTHING.smooth : SMOOTHING.normal;

  const { sampleRate, bufferSize } = useAudioSettings();

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

  const {
    data: recordingData,
    loading: recordingLoading,
    error: recordingError,
  } = useRecording(recordingId);

  const shouldUseStreaming = React.useMemo(() => {
    if (!recordingData) return false;
    return (
      recordingData.sampleCount > STREAMING_THRESHOLD_SAMPLES ||
      recordingData.sizeBytes > STREAMING_THRESHOLD_BYTES
    );
  }, [recordingData]);

  const streamingPlayback = useStreamingPlayback({
    recordingId: recordingId ?? "",
    chunkSize: 44_100,
    autoPlay: false,
    onEnded: () => {
      if (loopPlayback) {
        streamingPlayback.seek(0);
        streamingPlayback.play();
      }
    },
  });

  const recordingForDialogs: Recording | undefined = recordingData
    ? {
        id: recordingData.id,
        name: recordingData.name,
        duration: recordingData.durationMs,
        createdAt: recordingData.timestamp
          ? new Date(recordingData.timestamp).toISOString()
          : new Date().toISOString(),
        size: recordingData.sizeBytes,
      }
    : undefined;

  const canvasReference = React.useRef<HTMLCanvasElement | null>(null);

  const { handlers: dialogHandlers, Dialogs } = useSessionDialogs({
    mode: isPlaybackMode ? "playback" : "live",
    recording: recordingForDialogs,
    recordingId,
    canvasRef: canvasReference,
  });

  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentPlaybackTime, setCurrentPlaybackTime] = React.useState(0);
  const [playbackSpeed, setPlaybackSpeed] = React.useState(1);
  const [loopPlayback, setLoopPlayback] = React.useState(false);
  const animationFrameReference = React.useRef<number | undefined>(undefined);
  const lastTimestampReference = React.useRef<number | undefined>(undefined);

  const [calibrationDialogOpen, setCalibrationDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (shouldUseStreaming && streamingPlayback.state.isPlaying) {
      setCurrentPlaybackTime(streamingPlayback.state.currentTime);
      return;
    }

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
  }, [
    isPlaybackMode,
    isPlaying,
    recordingData,
    playbackSpeed,
    loopPlayback,
    shouldUseStreaming,
    streamingPlayback.state.isPlaying,
    streamingPlayback.state.currentTime,
  ]);

  const playbackWaveformData = React.useMemo(() => {
    if (!isPlaybackMode) {
      return [];
    }

    if (recordingData?.waveformOverview && recordingData.waveformOverview.length > 0) {
      const overview = recordingData.waveformOverview;
      const durationMs = recordingData.durationMs;
      const sampleCount = recordingData.sampleCount;

      if (durationMs === 0 || sampleCount === 0) {
        return overview;
      }

      const samplesPerMs = sampleCount / durationMs;
      const currentSampleIndex = Math.floor(currentPlaybackTime * samplesPerMs);

      const overviewPointCount = Math.floor(overview.length / 2);
      const samplesPerOverviewPoint = sampleCount / overviewPointCount;
      const currentOverviewIndex = Math.floor(currentSampleIndex / samplesPerOverviewPoint);

      const windowSize = 50;
      const halfWindow = Math.floor(windowSize / 2);
      const startIndex = Math.max(0, currentOverviewIndex - halfWindow) * 2;
      const endIndex = Math.min(overview.length, (currentOverviewIndex + halfWindow) * 2);

      return overview.slice(startIndex, endIndex);
    }

    return [];
  }, [isPlaybackMode, recordingData, currentPlaybackTime]);

  const waveformData = isPlaybackMode ? playbackWaveformData : audioAnalyzer.waveformData;

  const isCapturing = !isPlaybackMode && audioAnalyzer.isCapturing;
  const isPaused = !isPlaybackMode && audioAnalyzer.recordingState === "paused";

  const scopeName = "Oscilloscope";
  const recordingName = recordingData?.name;

  const isLoading = isPlaybackMode && recordingLoading;

  const error = isPlaybackMode ? recordingError : undefined;

  const handleBack = () => {
    if (shouldUseStreaming) {
      streamingPlayback.stop();
    }
    setIsPlaying(false);
    navigate("/");
  };

  const handlePlay = () => {
    if (!recordingData) return;

    if (shouldUseStreaming) {
      streamingPlayback.play();
    }
    setIsPlaying(true);
  };

  const handlePause = () => {
    if (shouldUseStreaming) {
      streamingPlayback.pause();
    }
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (shouldUseStreaming) {
      streamingPlayback.stop();
    }
    setIsPlaying(false);
    setCurrentPlaybackTime(0);
  };

  const handleSeek = (time: number) => {
    if (shouldUseStreaming) {
      streamingPlayback.seek(time);
    }
    setCurrentPlaybackTime(Math.max(0, Math.min(time, recordingData?.durationMs ?? 0)));
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (shouldUseStreaming) {
      streamingPlayback.setSpeed(speed);
    }
  };

  const handleLoopToggle = () => {
    setLoopPlayback((previous) => !previous);
  };

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

  const handleOpenCalibration = () => {
    setCalibrationDialogOpen(true);
  };

  const handleCloseCalibration = () => {
    setCalibrationDialogOpen(false);
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

  const buildDspMetrics = React.useCallback((): ScopeCaptureDspMetrics => {
    return {
      peakAmplitude: audioAnalyzer.peakLevel,
      rmsAmplitude: audioAnalyzer.volumeLevel,
      dcOffset: 0,
      dominantFrequency: audioAnalyzer.frequency,
      frequencyHigh: audioAnalyzer.frequency * 1.2,
      frequencyLow: audioAnalyzer.frequency * 0.8,
    };
  }, [audioAnalyzer.peakLevel, audioAnalyzer.volumeLevel, audioAnalyzer.frequency]);

  const handleProbe = async () => {
    if (!sessionId) {
      showToast({
        message: "No session selected. Please create or select a session first.",
        type: "error",
      });
      navigate("/");
      return;
    }

    try {
      await audioAnalyzer.startCapture();

      scopeCapture.startCapture(buildDspMetrics());
      showToast({ message: "Probe started - capturing audio", type: "success" });
    } catch {
      showToast({
        message: "Failed to start probe - check microphone permissions",
        type: "error",
      });
    }
  };

  const handlePauseCapture = () => {
    audioAnalyzer.pauseCapture();
    showToast({ message: "Capture paused", type: "info" });
  };

  const handleResumeCapture = () => {
    audioAnalyzer.resumeCapture();
    showToast({ message: "Capture resumed", type: "success" });
  };

  const handleStopCapture = () => {
    audioAnalyzer.stopCapture();

    scopeCapture.stopCapture();
    showToast({ message: "Capture stopped", type: "info" });
  };

  React.useEffect(() => {
    if (!isLiveMode || audioAnalyzer.recordingState === "idle" || !scopeCapture.isCapturing) {
      return;
    }

    const sendInterval = setInterval(() => {
      if (scopeCapture.activeSubSessionId || sessionId) {
        const samples = [...audioAnalyzer.samples];
        scopeCapture.sendWaveformData(samples, sampleRate, buildDspMetrics());
      }
    }, 100);

    return () => clearInterval(sendInterval);
  }, [
    isLiveMode,
    audioAnalyzer.recordingState,
    audioAnalyzer.samples,
    scopeCapture.isCapturing,
    scopeCapture,
    sessionId,
    sampleRate,
    buildDspMetrics,
  ]);

  React.useEffect(() => {
    if (!isLiveMode || audioAnalyzer.recordingState === "idle") {
      return;
    }

    const updateInterval = setInterval(() => {
      scopeCapture.updateMetrics(buildDspMetrics());
    }, 500);

    return () => clearInterval(updateInterval);
  }, [isLiveMode, audioAnalyzer.recordingState, scopeCapture, buildDspMetrics]);

  if (isLoading) {
    return (
      <div className="flex w-full h-screen bg-bg-primary text-foreground overflow-hidden">
        {}
        <div className="w-[72px] bg-bg-secondary border-r border-border-subtle flex flex-col pt-16 pb-3 px-2 gap-1">
          {[1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="flex flex-col items-center gap-1 py-2.5 px-1.5">
              <Skeleton className="w-6 h-6 rounded" />
              <Skeleton className="w-8 h-2 rounded" />
            </div>
          ))}
          <div className="flex-1" />
        </div>

        {}
        <div className="flex-1 flex flex-col min-w-0">
          {}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border-subtle">
            <Skeleton className="w-9 h-9 rounded-md" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-48" />
            <div className="flex-1" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="w-20 h-8 rounded-md" />
          </div>

          {}
          <div className="flex-1 relative bg-[#111820] min-h-0">
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner size={48} />
            </div>
          </div>

          {}
          <div className="border-t border-border-subtle bg-bg-secondary">
            {}
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
            {}
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

  if (error) {
    return (
      <div className="flex w-full h-screen bg-bg-primary text-foreground">
        <div className="flex-1 flex flex-col">
          {}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
            <button
              onClick={handleBack}
              className="p-2 rounded-md hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="text-sm font-medium">Error</span>
          </div>

          {}
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

  return (
    <div className="flex w-full h-screen bg-bg-primary text-foreground overflow-hidden">
      {}
      <div className="hidden md:block">
        <ScopeSidebar
          onOpenDisplaySettings={handleOpenDisplaySettings}
          onOpenTriggerSettings={handleOpenTriggerSettings}
          onOpenMeasurements={handleOpenMeasurements}
          onOpenCalibration={handleOpenCalibration}
          onOpenExport={handleOpenExport}
          onOpenRecordingInfo={handleOpenRecordingInfo}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      </div>

      {}
      <div className="flex-1 flex flex-col min-w-0">
        {}
        <ScopeTopBar
          mode={isPlaybackMode ? "playback" : "live"}
          scopeName={scopeName}
          recordingName={recordingName}
          sampleRate={sampleRate}
          recordingState={audioAnalyzer.recordingState}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          testMode={testMode}
          onToggleTestMode={toggleTestMode}
          onProbe={handleProbe}
          onPauseCapture={handlePauseCapture}
          onResumeCapture={handleResumeCapture}
          onStopCapture={handleStopCapture}
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
                  { id: "cal", label: "Cal", onClick: handleOpenCalibration },
                  { id: "export", label: "Export", onClick: handleOpenExport },
                ]
          }
        />

        {}
        <div className="flex-1 relative bg-[#111820] min-h-0">
          {}
          <ScopeCanvas
            waveformData={waveformData}
            isPaused={isPaused}
            analysisFrame={isPlaybackMode ? undefined : audioAnalyzer.analysisFrame}
            sampleRate={audioAnalyzer.sampleRate || sampleRate}
            forwardedRef={canvasReference}
          />

          {}
          {!isCapturing && waveformData.length === 0 && !isPlaybackMode && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#111820]/70">
              <p className="max-w-[300px] text-[14px] text-[#a1a1aa] text-center leading-relaxed">
                Press Probe to start capturing audio from your microphone.
              </p>
            </div>
          )}

          {}
          {isPlaybackMode && waveformData.length === 0 && !recordingLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#111820]/70">
              <p className="max-w-[300px] text-[14px] text-[#a1a1aa] text-center leading-relaxed">
                No waveform data available for this recording.
              </p>
            </div>
          )}
        </div>

        {}
        <ScopeBottomControls
          mode={isPlaybackMode ? "playback" : "live"}
          vpp={recordingData?.peakAmplitude ?? audioAnalyzer.vpp}
          frequency={audioAnalyzer.frequency}
          sampleRate={sampleRate}
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

      {}
      <Dialogs />

      {/* Calibration Dialog */}
      <AnchoredDialog
        isOpen={calibrationDialogOpen}
        onClose={handleCloseCalibration}
        maxWidth="max-w-[420px]"
      >
        <CalibrationDialog
          isOpen={calibrationDialogOpen}
          onClose={handleCloseCalibration}
          analysisData={serverAnalysis ?? undefined}
          isCapturing={scopeCapture.isCapturing}
        />
      </AnchoredDialog>
    </div>
  );
}

export default ScopePage;
