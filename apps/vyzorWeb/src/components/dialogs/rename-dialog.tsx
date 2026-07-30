import * as React from "react";

interface RenameDialogProperties {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// Global ref to store the current input value for browser automation
export const renameDialogInputReference = { current: undefined as HTMLInputElement | undefined };

export function RenameDialog({
  isOpen: _isOpen,
  value,
  onChange,
  onConfirm,
  onCancel,
  isLoading,
}: RenameDialogProperties) {
  const inputReference = React.useRef<HTMLInputElement>(null);

  // Keep the global ref in sync
  React.useEffect(() => {
    renameDialogInputReference.current = inputReference.current;
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") onConfirm();
    if (event.key === "Escape") onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} onKeyDown={undefined} />
      <div className="relative bg-[#27272a] border border-white/10 rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Rename Recording</h2>
        <input
          ref={inputReference}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          data-rename-input
          className="w-full px-3 py-2 bg-[#18181b] border border-white/10 rounded-md text-white placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#52525b]"
          autoFocus
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
            className="px-4 py-2 text-sm font-medium bg-[#3f3f46] text-white rounded-md hover:bg-[#52525b] transition-colors disabled:opacity-50"
          >
            {isLoading ? "Renaming..." : "Rename"}
          </button>
        </div>
      </div>
    </div>
  );
}
