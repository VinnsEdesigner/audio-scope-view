import * as React from "react";
import { Trash2, Loader2 } from "lucide-react";

interface EditSessionDialogProperties {
  isOpen: boolean;
  sessionId: string;
  sessionName: string;
  sessionDescription?: string;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  onDelete: () => void;
  isLoading?: boolean;
}

export function EditSessionDialog({
  isOpen,
  sessionId,
  sessionName,
  sessionDescription = "",
  onClose,
  onSave,
  onDelete,
  isLoading,
}: EditSessionDialogProperties) {
  const [name, setName] = React.useState(sessionName);
  const [description, setDescription] = React.useState(sessionDescription);
  const dialogReference = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setName(sessionName);
      setDescription(sessionDescription);
    }
  }, [isOpen, sessionName, sessionDescription]);

  React.useEffect(() => {
    if (isOpen) {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") onClose();
      };
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isOpen, onClose]);

  const handleSave = React.useCallback(() => {
    if (name.trim()) {
      onSave(name.trim(), description.trim());
    }
  }, [name, description, onSave]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === "Escape") onClose();
    },
    [onClose],
  );

  if (!isOpen) return;

  return (
    <>
      {/* Click outside to close */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={dialogReference}
        className="fixed z-50 top-16 right-4 bg-bg-secondary border border-border rounded-xl w-full max-w-[400px] overflow-hidden shadow-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-foreground">Edit Session</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md text-text-secondary hover:text-foreground hover:bg-bg-tertiary transition-all"
          >
            <svg
              width="14"
              height="14"
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
        <div className="px-4 py-4">
          {/* Session ID Banner */}
          <div className="flex items-center gap-3 p-2.5 bg-bg-tertiary border border-border-subtle rounded-lg mb-4">
            <div className="flex-1">
              <div className="text-[10px] text-text-tertiary uppercase tracking-wide">
                Session ID
              </div>
              <div className="text-xs text-text-secondary font-mono mt-0.5 truncate">
                {sessionId}
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-[10px] font-medium text-text-secondary uppercase tracking-wide mb-1">
              Session Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(event_) => setName(event_.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Morning Lab Testing"
              maxLength={100}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-foreground placeholder:text-text-tertiary focus:outline-none transition-all"
            />
            <div className="text-[10px] text-text-tertiary text-right mt-0.5">
              {name.length}/100
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-text-secondary uppercase tracking-wide mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(event_) => setDescription(event_.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a description..."
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-foreground placeholder:text-text-tertiary resize-none focus:outline-none transition-all"
            />
            <div className="text-[10px] text-text-tertiary text-right mt-0.5">
              {description.length}/500
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border-subtle bg-bg-tertiary">
          <button
            onClick={onDelete}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-transparent text-destructive border border-destructive/30 hover:bg-destructive/10 hover:border-destructive transition-all disabled:opacity-50"
          >
            <Trash2 size={12} />
            Delete
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            disabled={isLoading || !name.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md bg-bg-elevated text-foreground border border-border-hover hover:bg-bg-hover hover:border-border-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && <Loader2 size={12} className="animate-spin" />}
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}
