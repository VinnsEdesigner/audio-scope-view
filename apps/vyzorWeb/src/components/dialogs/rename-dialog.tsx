import * as React from "react";

interface RenameDialogProperties {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function RenameDialog({
  isOpen: _isOpen,
  value,
  onChange,
  onConfirm,
  onCancel,
  isLoading,
}: RenameDialogProperties) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} onKeyDown={undefined} />
      <div className="relative bg-[#27272a] border border-white/10 rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Rename Recording</h2>
        <input
          type="text"
          value={value}
          onChange={(event_) => onChange(event_.target.value)}
          className="w-full px-3 py-2 bg-[#18181b] border border-white/10 rounded-md text-white placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-accent"
          autoFocus
          onKeyDown={(event_) => {
            if (event_.key === "Enter") onConfirm();
            if (event_.key === "Escape") onCancel();
          }}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-[#a1a1aa] hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading || !value.trim()}
            className="px-4 py-2 text-sm font-medium bg-white text-[#09090b] rounded-md hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Renaming..." : "Rename"}
          </button>
        </div>
      </div>
    </div>
  );
}
