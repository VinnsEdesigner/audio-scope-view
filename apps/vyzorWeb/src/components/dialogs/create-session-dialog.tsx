import * as React from "react";
import { Loader2 } from "lucide-react";

interface CreateSessionDialogProperties {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, description: string) => void;
  isLoading?: boolean;
  afterCreate?: (sessionId: string) => void;
}

export function CreateSessionDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  afterCreate: _afterCreate,
}: CreateSessionDialogProperties) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  React.useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
    }
  }, [isOpen]);

  const handleConfirm = React.useCallback(() => {
    if (name.trim()) {
      onConfirm(name.trim(), description.trim());
    }
  }, [name, description, onConfirm]);

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
      <div className="fixed z-50 top-16 right-20 bg-bg-secondary border border-border rounded-xl w-full max-w-[400px] overflow-hidden shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-foreground">Create New Session</h2>
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
          {/* Description */}
          <div className="mb-4 p-3 bg-bg-tertiary rounded-lg border border-border-subtle">
            <p className="text-xs text-text-secondary leading-relaxed">
              A session is a container that groups your audio recordings and clips together. Create
              one to organize your work by project, location, or time period — all your recordings
              within a session share the same context and can be compared side-by-side.
            </p>
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
              maxLength={100}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-foreground placeholder:text-text-tertiary focus:outline-none transition-all"
              autoFocus
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
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-subtle">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-bg-tertiary text-text-secondary border border-border hover:bg-bg-hover hover:text-foreground transition-all disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !name.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md bg-bg-elevated text-foreground border border-border-hover hover:bg-bg-hover hover:border-border-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && <Loader2 size={12} className="animate-spin" />}
            {isLoading ? "Creating..." : "Create Session"}
          </button>
        </div>
      </div>
    </>
  );
}
