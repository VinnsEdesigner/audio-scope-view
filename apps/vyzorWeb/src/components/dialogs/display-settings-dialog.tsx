import * as React from "react";
import { X } from "lucide-react";
import { useUIStore } from "@/store";

interface DisplaySettingsDialogProperties {
  isOpen: boolean;
  onClose: () => void;
  onCancel?: () => void;
  onSave?: () => void;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
        checked ? "border-accent bg-accent" : "border-border bg-bg-primary"
      }`}
    >
      <span
        className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

interface SettingRowProperties {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SettingRow({ label, description, checked, onChange }: SettingRowProperties) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border-subtle last:border-b-0">
      <div>
        <div className="text-sm text-foreground">{label}</div>
        <div className="text-xs text-text-tertiary mt-0.5">{description}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export function DisplaySettingsDialog({
  isOpen,
  onClose,
  onCancel,
  onSave,
}: DisplaySettingsDialogProperties) {
  const { showGrid, setShowGrid, glow, setGlow, autoScale, setAutoScale, invert, setInvert } =
    useUIStore();

  const [localShowGrid, setLocalShowGrid] = React.useState(showGrid);
  const [localGlow, setLocalGlow] = React.useState(glow);
  const [localAutoScale, setLocalAutoScale] = React.useState(autoScale);
  const [localInvert, setLocalInvert] = React.useState(invert);

  React.useEffect(() => {
    if (isOpen) {
      setLocalShowGrid(showGrid);
      setLocalGlow(glow);
      setLocalAutoScale(autoScale);
      setLocalInvert(invert);
    }
  }, [isOpen, showGrid, glow, autoScale, invert]);

  const handleSave = () => {
    setShowGrid(localShowGrid);
    setGlow(localGlow);
    setAutoScale(localAutoScale);
    setInvert(localInvert);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  // When used inside AnchoredDialog, use prop callbacks; otherwise use internal handlers
  const handleSaveFinal = onSave || handleSave;
  const handleCancelFinal = onCancel || handleCancel;

  return (
    <div className="w-[320px]">
      {/* Header - matches AnchoredDialog style */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <h2 className="text-base font-semibold text-foreground tracking-tight">Display Settings</h2>
        <button
          onClick={handleCancelFinal}
          className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:text-foreground hover:bg-bg-hover transition-all"
          aria-label="Close dialog"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="space-y-0">
          <SettingRow
            label="Grid"
            description="Show grid lines on canvas"
            checked={localShowGrid}
            onChange={setLocalShowGrid}
          />
          <SettingRow
            label="Glow"
            description="Add glow effect to waveform"
            checked={localGlow}
            onChange={setLocalGlow}
          />
          <SettingRow
            label="Auto-scale"
            description="Automatically fit trace to screen"
            checked={localAutoScale}
            onChange={setLocalAutoScale}
          />
          <SettingRow
            label="Invert"
            description="Invert waveform vertically"
            checked={localInvert}
            onChange={setLocalInvert}
          />
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={handleCancelFinal}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveFinal}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer border border-border bg-bg-elevated shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
