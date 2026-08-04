import * as React from "react";
import { Loader2 } from "lucide-react";
import { InlineSelect } from "@/components/ui/inline-select";
import { TIMEOUT_OPTIONS } from "@/hooks/use-session-settings";
import { useToast } from "@/hooks";

interface SessionSettingsDialogProperties {
  isOpen: boolean;
  autoSelectLastSession: boolean;
  autoCloseTimeoutSecs: number | null;
  onClose: () => void;
  onSave: (autoSelectLastSession: boolean, autoCloseTimeoutSecs: number | null) => void;
  isLoading?: boolean;
}

export function SessionSettingsDialog({
  isOpen,
  autoSelectLastSession,
  autoCloseTimeoutSecs,
  onClose,
  onSave,
  isLoading,
}: SessionSettingsDialogProperties) {
  const [autoSelect, setAutoSelect] = React.useState(autoSelectLastSession);
  const [timeoutSecs, setTimeoutSecs] = React.useState<number | null>(autoCloseTimeoutSecs);
  const { showToast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      setAutoSelect(autoSelectLastSession);
      setTimeoutSecs(autoCloseTimeoutSecs);
    }
  }, [isOpen, autoSelectLastSession, autoCloseTimeoutSecs]);

  const handleToggle = React.useCallback(() => {
    setAutoSelect((previous) => !previous);
  }, []);

  const handleSave = React.useCallback(() => {
    // Show descriptive toast
    const timeoutLabel = timeoutSecs
      ? (TIMEOUT_OPTIONS.find((o) => o.value === timeoutSecs)?.label ?? `${timeoutSecs}s`)
      : "No timeout";
    showToast({
      message: `Auto-select ${autoSelect ? "enabled" : "disabled"}, timeout: ${timeoutLabel}`,
      type: "success",
    });
    onSave(autoSelect, timeoutSecs);
  }, [autoSelect, timeoutSecs, onSave, showToast]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    },
    [onClose],
  );

  React.useEffect(() => {
    if (isOpen) {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") onClose();
      };
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return;

  return (
    <>
      {/* Click outside to close */}
      <div className="fixed inset-0 z-40 pointer-events-none" onClick={onClose} />
      <div
        className="fixed z-50 top-16 right-20 bg-bg-secondary border border-border rounded-xl w-full max-w-[420px] overflow-hidden shadow-lg pointer-events-auto"
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-base font-semibold text-foreground">Session Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:text-foreground hover:bg-bg-tertiary transition-all"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-6">
          {/* Auto-select toggle */}
          <div className="setting-group">
            <div className="setting-row">
              <div className="setting-info flex-1 mr-4">
                <div className="text-sm font-medium text-foreground">Auto-select Last Session</div>
                <div className="text-[11px] text-text-tertiary mt-1 leading-relaxed">
                  When enabled, automatically use the last session for recordings and live captures.
                  When disabled, always show session selection dialog.
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle();
                }}
                className={`relative w-11 h-6.5 bg-bg-primary border rounded-full cursor-pointer transition-all flex-shrink-0 ${
                  autoSelect ? "bg-rose-400 border-rose-400" : "border-border"
                }`}
                style={{ height: "26px" }}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-foreground rounded-full shadow transition-all ${
                    autoSelect ? "translate-x-[18px]" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Session timeout */}
          <div className="setting-group">
            <div className="setting-row items-start">
              <div className="setting-info flex-1 mr-4">
                <div className="text-sm font-medium text-foreground">Session Timeout</div>
                <div className="text-[11px] text-text-tertiary mt-1 leading-relaxed">
                  Automatically close inactive sessions after this duration. When set to "No
                  timeout", sessions will remain open indefinitely until manually closed.
                </div>
              </div>
            </div>
            <div className="mt-3">
              <InlineSelect
                value={timeoutSecs}
                options={TIMEOUT_OPTIONS}
                onChange={(selectedValue) => setTimeoutSecs(selectedValue as number | null)}
                placeholder="Select timeout"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 bg-bg-tertiary border-t border-border-subtle">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md bg-bg-secondary text-text-secondary border border-border hover:bg-bg-hover hover:text-foreground transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md bg-bg-elevated text-foreground hover:bg-bg-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}
