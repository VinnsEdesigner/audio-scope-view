import * as React from "react";
import { X } from "lucide-react";
import { useUIStore } from "@/store";
import type { SessionMode } from "@/store";

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
  const { triggerEdge, setTriggerEdge, triggerLevel, setTriggerLevel } = useUIStore();

  const isPlayback = mode === "playback";

  const [localEdge, setLocalEdge] = React.useState<TriggerEdge>(triggerEdge);
  const [localLevel, setLocalLevel] = React.useState(triggerLevel);

  React.useEffect(() => {
    if (isOpen) {
      setLocalEdge(triggerEdge);
      setLocalLevel(triggerLevel);
    }
  }, [isOpen, triggerEdge, triggerLevel]);

  const handleSave = () => {
    setTriggerEdge(localEdge);
    setTriggerLevel(localLevel);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="w-[320px]">
      {/* Header */}
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

      {/* Content */}
      <div className="p-4">
        {isPlayback && (
          <div className="mb-4 p-3 bg-bg-elevated rounded-lg border border-border">
            <p className="text-sm text-text-secondary">
              Trigger settings are not available in playback mode.
            </p>
          </div>
        )}
        <div className={`space-y-6 ${isPlayback ? "opacity-50 pointer-events-none" : ""}`}>
          {/* Edge Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Edge</label>
            <div className="flex gap-2">
              {EDGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setLocalEdge(option.value)}
                  disabled={isPlayback}
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

          {/* Level Slider */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Level</label>
            <Slider
              value={localLevel}
              onChange={setLocalLevel}
              min={-1}
              max={1}
              step={0.01}
              formatValue={formatVoltage}
              disabled={isPlayback}
            />
          </div>
        </div>

        {/* Footer buttons */}
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
