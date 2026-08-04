import * as React from "react";
import { X } from "lucide-react";
import { useUIStore } from "@/store";
import type { SessionMode, TriggerMode } from "@/store";

interface TriggerSettingsDialogProperties {
  isOpen: boolean;
  onClose: () => void;
  mode?: SessionMode;
}

type TriggerEdge = "rising" | "falling" | "auto";

const EDGE_OPTIONS: { value: TriggerEdge; label: string }[] = [
  { value: "rising", label: "Rising" },
  { value: "falling", label: "Falling" },
  { value: "auto", label: "Auto" },
];

const MODE_OPTIONS: { value: TriggerMode; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Free-runs when no edge is found" },
  { value: "normal", label: "Normal", hint: "Holds the last triggered frame" },
  { value: "single", label: "Single", hint: "Captures one frame, then holds" },
];

function formatVoltage(voltage: number): string {
  const volts = voltage;
  return `${volts >= 0 ? "+" : ""}${volts.toFixed(2)} V`;
}

function Slider({
  value,
  onChange,
  min = -1,
  max = 1,
  step = 0.01,
  formatValue,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (value: number) => string;
  disabled?: boolean;
}) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`flex items-center gap-3 ${disabled ? "opacity-50" : ""}`}>
      <div className="relative flex-1 h-1.5 bg-bg-elevated rounded-full">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-accent"
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
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md pointer-events-none"
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>
      <span className="min-w-[60px] text-right text-sm font-mono text-text-secondary">
        {formatValue ? formatValue(value) : value.toFixed(2)}
      </span>
    </div>
  );
}

export function TriggerSettingsDialog({
  isOpen,
  onClose,
  mode = "live",
}: TriggerSettingsDialogProperties) {
  const {
    triggerEdge,
    setTriggerEdge,
    triggerLevel,
    setTriggerLevel,
    triggerMode,
    setTriggerMode,
    triggerEnabled,
    setTriggerEnabled,
  } = useUIStore();

  const isPlayback = mode === "playback";

  const [localEdge, setLocalEdge] = React.useState<TriggerEdge>(triggerEdge);
  const [localLevel, setLocalLevel] = React.useState(triggerLevel);
  const [localMode, setLocalMode] = React.useState<TriggerMode>(triggerMode);
  const [localEnabled, setLocalEnabled] = React.useState(triggerEnabled);

  React.useEffect(() => {
    if (isOpen) {
      setLocalEdge(triggerEdge);
      setLocalLevel(triggerLevel);
      setLocalMode(triggerMode);
      setLocalEnabled(triggerEnabled);
    }
  }, [isOpen, triggerEdge, triggerLevel, triggerMode, triggerEnabled]);

  const handleSave = () => {
    setTriggerEdge(localEdge);
    setTriggerLevel(localLevel);
    setTriggerMode(localMode);
    setTriggerEnabled(localEnabled);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="w-[320px]">
      {}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <h2 className="text-base font-semibold text-foreground tracking-tight">Trigger Settings</h2>
        <button
          onClick={handleCancel}
          className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:text-foreground hover:bg-bg-hover transition-all"
          aria-label="Close dialog"
        >
          <X size={16} />
        </button>
      </div>

      {}
      <div className="p-4">
        {isPlayback && (
          <div className="mb-4 p-3 bg-bg-elevated rounded-lg border border-border">
            <p className="text-sm text-text-secondary">
              Trigger settings are not available in playback mode.
            </p>
          </div>
        )}
        <div className={`space-y-6 ${isPlayback ? "opacity-50 pointer-events-none" : ""}`}>
          {}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Trigger</label>
            <button
              onClick={() => setLocalEnabled(!localEnabled)}
              disabled={isPlayback}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                localEnabled
                  ? "bg-bg-elevated text-foreground border-border"
                  : "bg-transparent text-text-secondary border-border hover:bg-bg-hover"
              }`}
            >
              {localEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>

          {}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Mode</label>
            <div className="flex gap-2">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setLocalMode(option.value)}
                  disabled={isPlayback || !localEnabled}
                  title={option.hint}
                  className={`flex-1 py-2.5 px-3 rounded-md text-sm font-medium transition-colors border ${
                    localMode === option.value
                      ? "bg-bg-elevated text-foreground border-border"
                      : "bg-transparent text-text-secondary border-border hover:bg-bg-hover hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              {MODE_OPTIONS.find((option) => option.value === localMode)?.hint}
            </p>
          </div>

          {}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Edge</label>
            <div className="flex gap-2">
              {EDGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setLocalEdge(option.value)}
                  disabled={isPlayback || !localEnabled}
                  className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors border ${
                    localEdge === option.value
                      ? "bg-bg-elevated text-foreground border-border"
                      : "bg-transparent text-text-secondary border-border hover:bg-bg-hover hover:text-foreground"
                  } ${isPlayback ? "cursor-not-allowed" : ""}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Level</label>
            <Slider
              value={localLevel}
              onChange={setLocalLevel}
              min={-1}
              max={1}
              step={0.01}
              formatValue={formatVoltage}
              disabled={isPlayback || !localEnabled}
            />
          </div>
        </div>

        {}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={handleCancel}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer border border-border bg-bg-elevated shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
