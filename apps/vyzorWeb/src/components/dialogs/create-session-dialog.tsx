import * as React from "react";

interface CreateSessionDialogProperties {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, description: string) => void;
  isLoading?: boolean;
}

export function CreateSessionDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: CreateSessionDialogProperties) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const handleConfirm = React.useCallback(() => {
    if (name.trim()) {
      onConfirm(name.trim(), description.trim());
    }
  }, [name, description, onConfirm]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Escape") onClose();
  };

  if (!isOpen) return;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border rounded-xl w-full max-w-[420px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-base font-semibold text-foreground">Create New Session</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:text-foreground hover:bg-bg-tertiary transition-all"
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
        <div className="px-5 py-5">
          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
              Session Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(event_) => setName(event_.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Morning Lab Testing"
              maxLength={100}
              className="w-full px-3.5 py-2.5 bg-bg-tertiary border border-border rounded-md text-sm text-foreground placeholder:text-text-tertiary focus:outline-none focus:border-icon transition-all"
              autoFocus
            />
            <div className="text-xs text-text-tertiary text-right mt-1">{name.length}/100</div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(event_) => setDescription(event_.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a description for this session..."
              maxLength={500}
              rows={3}
              className="w-full px-3.5 py-2.5 bg-bg-tertiary border border-border rounded-md text-sm text-foreground placeholder:text-text-tertiary resize-none focus:outline-none focus:border-icon transition-all"
            />
            <div className="text-xs text-text-tertiary text-right mt-1">
              {description.length}/500
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-border-subtle">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-bg-tertiary text-text-secondary border border-border hover:bg-bg-hover hover:text-foreground transition-all disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !name.trim()}
            className="px-4 py-2 text-sm font-medium rounded-md bg-bg-tertiary text-foreground border border-border hover:bg-bg-hover hover:border-border-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Creating..." : "Create Session"}
          </button>
        </div>
      </div>
    </div>
  );
}
