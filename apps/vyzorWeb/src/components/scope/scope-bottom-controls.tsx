import * as React from "react";
import { ChevronDown, Repeat } from "lucide-react";
import { useUIStore } from "@/store";
import { useAudioAnalyzer } from "@/hooks";
import type { SessionMode } from "@/store";

interface SliderProperties {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
}: SliderProperties) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`relative h-1.5 bg-bg-primary rounded-full ${disabled ? "opacity-50" : ""}`}>
      <div
        className="absolute left-0 top-0 h-full rounded-full bg-foreground"
        style={{ width: `${percentage}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event_) => onChange(Number.parseFloat(event_.target.value))}
        disabled={disabled}
        className={`absolute inset-0 w-full h-full opacity-0 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-foreground rounded-full shadow-md pointer-events-none"
        style={{ left: `calc(${percentage}% - 8px)` }}
      />
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface ScopeBottomControlsProperties {
  mode?: SessionMode;
  vpp?: number;
  frequency?: number;
  windowMs?: number;
  timebase?: number;
  verticalGain?: number;
  onTimebaseChange?: (value: number) => void;
  onVerticalGainChange?: (value: number) => void;

  duration?: number;
  currentTime?: number;
  onSeek?: (time: number) => void;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  playbackSpeed?: number;
  onSpeedChange?: (speed: number) => void;
  loopPlayback?: boolean;
  onLoopToggle?: () => void;
}

export function ScopeBottomControls({
  mode = "live",
  vpp,
  frequency,
  windowMs,
  timebase: controlledTimebase,
  verticalGain: controlledVerticalGain,
  onTimebaseChange,
  onVerticalGainChange,
  duration,
  currentTime,
  onSeek,
  isPlaying: _controlledIsPlaying,
  onPlay: _onPlay,
  onPause: _onPause,
  onStop: _onStop,
  playbackSpeed: controlledPlaybackSpeed,
  onSpeedChange,
  loopPlayback = false,
  onLoopToggle,
}: ScopeBottomControlsProperties) {
  const store = useUIStore();
  const { showMeasurements } = store;
  const audioAnalyzer = useAudioAnalyzer();

  const isPlayback = mode === "playback";

  const effectiveTimebase = controlledTimebase ?? store.timebase;
  const effectiveVerticalGain = controlledVerticalGain ?? store.verticalGain;
  const effectiveVpp = vpp ?? audioAnalyzer.vpp;
  const effectiveFrequency = frequency ?? audioAnalyzer.frequency;
  const effectiveSampleRate = audioAnalyzer.sampleRate;
  const effectiveWindowMs =
    windowMs ?? (effectiveSampleRate > 0 ? (effectiveTimebase / effectiveSampleRate) * 1000 : 0);

  const effectivePlaybackSpeed = controlledPlaybackSpeed ?? store.playbackSpeed;
  const effectiveCurrentTime = currentTime ?? store.currentPlaybackTime;
  const effectiveDuration = duration ?? store.playbackDuration;

  const handleSpeedChange = (speed: number) => {
    if (onSpeedChange) {
      onSpeedChange(speed);
    } else {
      store.setPlaybackSpeed(speed);
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isPlayback || !onSeek || !effectiveDuration) return;
    const time = Number.parseFloat(event.target.value);
    if (onSeek) {
      onSeek(time);
    } else {
      store.setCurrentPlaybackTime(time);
    }
  };

  const handleLoopToggle = () => {
    if (onLoopToggle) {
      onLoopToggle();
    } else {
      store.setLoopPlayback(!store.loopPlayback);
    }
  };

  const [isExpanded, setIsExpanded] = React.useState(true);
  const [view, setView] = React.useState<"time" | "spectrum">("time");

  const handleTimebaseChange = (value: number) => {
    if (isPlayback) return;
    if (onTimebaseChange) {
      onTimebaseChange(value);
    } else {
      store.setTimebase(value);
    }
  };

  const handleVerticalGainChange = (value: number) => {
    if (isPlayback) return;
    if (onVerticalGainChange) {
      onVerticalGainChange(value);
    } else {
      store.setVerticalGain(value);
    }
  };

  const seekPercentage =
    effectiveDuration > 0 ? (effectiveCurrentTime / effectiveDuration) * 100 : 0;

  const playbackSpeeds = [0.5, 1, 1.5, 2];

  return (
    <div className="border-t border-border-subtle bg-bg-secondary">
      {}
      {isPlayback && (
        <div className="px-3 py-2 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <div className="relative h-2 bg-bg-primary rounded-full">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-accent"
                  style={{ width: `${seekPercentage}%` }}
                />
                <input
                  type="range"
                  min={0}
                  max={effectiveDuration}
                  step={100}
                  value={effectiveCurrentTime}
                  onChange={handleSeek}
                  disabled={!onSeek && !store.playbackDuration}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-foreground rounded-full shadow-md pointer-events-none"
                  style={{ left: `calc(${seekPercentage}% - 6px)` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-mono text-foreground min-w-[80px] justify-end">
              <span>{formatTime(effectiveCurrentTime)}</span>
              <span className="text-text-tertiary">/</span>
              <span className="text-text-tertiary">{formatTime(effectiveDuration)}</span>
            </div>
          </div>

          {}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-text-secondary">Speed:</span>
              <div className="flex gap-1">
                {playbackSpeeds.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      effectivePlaybackSpeed === speed
                        ? "bg-foreground text-bg-primary"
                        : "bg-transparent text-text-secondary hover:bg-bg-elevated"
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {}
              <button
                onClick={handleLoopToggle}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  loopPlayback
                    ? "bg-foreground text-bg-primary"
                    : "bg-transparent text-text-secondary hover:bg-bg-elevated"
                }`}
                title="Loop playback"
              >
                <Repeat size={12} />
                Loop
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex gap-4 text-[11px]">
          {showMeasurements && (
            <>
              <div className="flex gap-1">
                <span className="uppercase text-foreground/80">Vpp</span>
                <span className="font-mono text-foreground">{effectiveVpp.toFixed(3)}</span>
              </div>
              <div className="flex gap-1">
                <span className="uppercase text-foreground/80">Freq</span>
                <span className="font-mono text-foreground">
                  {effectiveFrequency > 0 ? `${effectiveFrequency.toFixed(1)} Hz` : "— Hz"}
                </span>
              </div>
              <div className="flex gap-1">
                <span className="uppercase text-foreground/80">Win</span>
                <span className="font-mono text-foreground">{effectiveWindowMs.toFixed(2)} ms</span>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 px-2 py-1 rounded text-[12px] text-foreground/80 hover:bg-bg-elevated hover:text-foreground transition-colors"
        >
          Controls
          <ChevronDown
            size={14}
            className={`transition-transform ${isExpanded ? "" : "-rotate-90"}`}
          />
        </button>
      </div>

      {}
      {isExpanded && (
        <div className="px-3 py-3 border-t border-border-subtle flex flex-col gap-3">
          {}
          <div className="flex gap-1.5">
            {(["time", "spectrum"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex-1 py-2 rounded-md text-[13px] font-medium capitalize transition-colors ${
                  view === v
                    ? "bg-bg-elevated text-foreground"
                    : "bg-transparent text-foreground/80 hover:bg-bg-elevated"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[12px]">
              <span className="text-foreground/80">Timebase {isPlayback && "(read-only)"}</span>
              <span className="font-mono text-foreground">{effectiveTimebase} smp</span>
            </div>
            <Slider
              value={effectiveTimebase}
              onChange={handleTimebaseChange}
              min={256}
              max={4096}
              step={128}
              disabled={isPlayback}
            />
          </div>

          {}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[12px]">
              <span className="text-foreground/80">
                Vertical gain {isPlayback && "(read-only)"}
              </span>
              <span className="font-mono text-foreground">{effectiveVerticalGain.toFixed(1)}x</span>
            </div>
            <Slider
              value={effectiveVerticalGain}
              onChange={handleVerticalGainChange}
              min={0.1}
              max={2}
              step={0.1}
              disabled={isPlayback}
            />
          </div>
        </div>
      )}
    </div>
  );
}
