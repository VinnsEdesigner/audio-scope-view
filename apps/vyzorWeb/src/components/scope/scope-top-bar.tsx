import * as React from "react";
import { Sun, Play, Pause, Square } from "lucide-react";
import { TestModeIcon } from "@/components/icons/test-mode-icon";
import { useAudioAnalyzer } from "@/hooks";
import type { SessionMode } from "@/store";

interface ScopeTopBarProperties {
  mode?: SessionMode;
  scopeName?: string;
  recordingName?: string;
  sampleRate?: number;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  testMode?: boolean;
  onToggleTestMode?: () => void;
  onProbe?: () => Promise<void>;
  onPauseCapture?: () => void;
  onResumeCapture?: () => void;
  onStopCapture?: () => void;
}

export function ScopeTopBar({
  mode = "live",
  scopeName,
  recordingName,
  sampleRate,
  isPlaying = false,
  onPlay,
  onPause,
  onStop,
  testMode = false,
  onToggleTestMode,
  onProbe,
  onPauseCapture,
  onResumeCapture,
  onStopCapture,
}: ScopeTopBarProperties) {
  const { sampleRate: liveSampleRate, recordingState } = useAudioAnalyzer();

  const isCapturing = recordingState === "recording";
  const isPaused = recordingState === "paused";
  const isIdle = recordingState === "idle";

  const isPlayback = mode === "playback";
  const effectiveSampleRate = sampleRate ?? liveSampleRate;

  const handleFreeze = () => {
    if (isCapturing) {
      onPauseCapture?.();
    } else if (isPaused) {
      onResumeCapture?.();
    }
  };

  const handleProbe = async () => {
    if (isIdle) {
      await onProbe?.();
    } else {
      onStopCapture?.();
    }
  };

  const handlePlay = () => {
    onPlay?.();
  };

  const handlePause = () => {
    onPause?.();
  };

  const handleStop = () => {
    onStop?.();
  };

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-2 border-b border-border-subtle">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            {isPlayback ? recordingName || "Recording" : scopeName || "Scope"}
          </h1>
          <p className="text-lg text-foreground/70">
            {effectiveSampleRate.toLocaleString()} Hz · {isPlayback ? "playback" : "local trace"}
          </p>
        </div>
      </div>

      <div />

      <div className="flex items-center gap-1.5">
        {isPlayback ? (
          // PLAYBACK mode controls
          <>
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[15px] font-medium bg-[#3f3f46] text-white hover:bg-[#52525b] transition-colors"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
              {isPlaying ? "Paused" : "Play"}
            </button>
            <button
              onClick={handleStop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[15px] font-medium bg-[#3f3f46] text-white hover:bg-[#52525b] transition-colors"
            >
              <Square size={18} fill="currentColor" />
              Stop
            </button>
          </>
        ) : (
          // LIVE mode controls
          <>
            <button
              onClick={handleFreeze}
              disabled={isIdle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[15px] font-medium bg-[#3f3f46] text-white hover:bg-[#52525b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPaused ? <Play size={18} fill="currentColor" /> : <Sun size={18} />}
              {isPaused ? "Resume" : "Freeze"}
            </button>

            <button
              onClick={handleProbe}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[15px] font-medium transition-colors ${
                isIdle
                  ? "bg-[#3f3f46] text-white hover:bg-[#52525b]"
                  : "bg-[#3f3f46] text-white hover:bg-[#52525b]"
              }`}
            >
              {isCapturing ? (
                <>
                  <Square size={18} fill="currentColor" />
                  Stop
                </>
              ) : isPaused ? (
                <>
                  <Square size={18} fill="currentColor" />
                  Stop
                </>
              ) : (
                <>
                  <Play size={18} fill="currentColor" />
                  Probe
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Test Mode Toggle */}
      <button
        onClick={onToggleTestMode}
        className={`ml-2 p-2 rounded-md transition-colors ${
          testMode
            ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
            : "bg-bg-elevated text-text-secondary hover:text-foreground"
        }`}
        title={testMode ? "Test Mode Active - Click to disable" : "Enable Test Mode (Mock Audio)"}
      >
        <TestModeIcon size={16} />
      </button>
    </div>
  );
}
