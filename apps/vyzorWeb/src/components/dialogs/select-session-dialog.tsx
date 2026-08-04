import * as React from "react";
import { Radio, Loader2 } from "lucide-react";
import type { SessionWithStatus } from "@/hooks";
import { formatTimestampRelative } from "@/hooks";
import { Skeleton } from "@/components/ui/skeleton";

interface SelectSessionDialogProperties {
  isOpen: boolean;
  sessions: SessionWithStatus[];
  selectedSessionId: string | null | undefined;
  onClose: () => void;
  onSelect: (sessionId: string) => void;
  onCreateNew: () => void;
  isLoading?: boolean;
  required?: boolean;
}

export function SelectSessionDialog({
  isOpen,
  sessions,
  selectedSessionId,
  onClose,
  onSelect,
  onCreateNew,
  isLoading,
  required = false,
}: SelectSessionDialogProperties) {
  // Local state to track the selected session within the dialog
  // This allows the dialog to auto-select a pre-selected session and still let users change selection
  const [localSelectedSessionId, setLocalSelectedSessionId] = React.useState<string | undefined>(
    selectedSessionId ?? undefined,
  );

  // Sync local selection with prop when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      // Initialize or sync local selection with the prop
      setLocalSelectedSessionId(selectedSessionId ?? undefined);
    }
  }, [isOpen, selectedSessionId]);

  const handleSelect = React.useCallback(
    (sessionId: string) => {
      setLocalSelectedSessionId(sessionId);
      onSelect(sessionId);
    },
    [onSelect],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    },
    [onClose],
  );

  React.useEffect(() => {
    if (isOpen) {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape" && !required) {
          onClose();
        }
      };
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, onClose, required]);

  // Use local selection for UI, falling back to prop for initial state
  const effectiveSelectedId = localSelectedSessionId ?? selectedSessionId;

  if (!isOpen) return;

  const handleBackdropClick = () => {
    if (!required) {
      onClose();
    }
  };

  const handleCloseClick = () => {
    if (!required) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={handleBackdropClick} />
      <div
        className="relative bg-bg-secondary border border-border rounded-xl w-full max-w-[480px] overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-base font-semibold text-foreground">Select Session</h2>
          <button
            onClick={handleCloseClick}
            disabled={required}
            className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:text-foreground hover:bg-bg-tertiary transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              width="18"
              height="18"
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
        <div className="px-5 py-5 max-h-[400px] overflow-y-auto">
          {/* Required note */}
          {required && (
            <div className="flex items-center gap-2.5 p-3 bg-bg-tertiary rounded-md mb-4">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-icon flex-shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span className="text-xs text-text-secondary">
                You must select a session to continue
              </span>
            </div>
          )}

          {/* Session list */}
          <div className="flex flex-col gap-2">
            {isLoading ? (
              // Loading skeletons
              <>
                <div className="flex items-center gap-3 p-3.5 bg-bg-tertiary border-2 border-transparent rounded-lg animate-pulse">
                  <Skeleton className="w-[18px] h-[18px] rounded-full" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="w-12 h-5 rounded" />
                </div>
                <div className="flex items-center gap-3 p-3.5 bg-bg-tertiary border-2 border-transparent rounded-lg animate-pulse">
                  <Skeleton className="w-[18px] h-[18px] rounded-full" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="w-12 h-5 rounded" />
                </div>
                <div className="flex items-center gap-3 p-3.5 bg-bg-tertiary border-2 border-transparent rounded-lg animate-pulse">
                  <Skeleton className="w-[18px] h-[18px] rounded-full" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                  <Skeleton className="w-12 h-5 rounded" />
                </div>
              </>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-text-tertiary">
                <Radio size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No sessions available</p>
              </div>
            ) : (
              sessions.map((session) => {
                const isSelected = session.id === effectiveSelectedId;
                return (
                  <div
                    key={session.id}
                    onClick={() => handleSelect(session.id)}
                    className={`flex items-center gap-3 p-3.5 bg-bg-tertiary border-2 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? "border-icon bg-bg-hover"
                        : "border-transparent hover:bg-bg-hover hover:border-border-hover"
                    }`}
                  >
                    <div
                      className={`w-[18px] h-[18px] border-2 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isSelected ? "border-foreground" : "border-icon"
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 bg-foreground rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {session.name || `Session ${session.id.slice(0, 8)}`}
                      </div>
                      <div className="text-xs text-text-tertiary mt-0.5">
                        {session.recordingCount} recordings • Started{" "}
                        {formatTimestampRelative(session.startedAt)}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-[10px] font-medium uppercase ${
                        session.status === "live"
                          ? "bg-icon/15 text-icon"
                          : session.status === "paused"
                            ? "bg-icon/15 text-icon"
                            : "bg-bg-secondary text-text-secondary"
                      }`}
                    >
                      {session.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border-subtle">
          <button
            onClick={onCreateNew}
            disabled={isLoading}
            className="text-xs text-icon hover:text-foreground transition-colors disabled:opacity-50"
          >
            + Create New Session
          </button>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium rounded-md bg-bg-tertiary text-text-secondary border border-border hover:bg-bg-hover hover:text-foreground transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => effectiveSelectedId && onSelect(effectiveSelectedId)}
              disabled={isLoading || !effectiveSelectedId}
              className="px-4 py-2 text-sm font-medium rounded-md bg-bg-tertiary text-foreground border border-border hover:bg-bg-hover hover:border-border-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : "Select Session"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
