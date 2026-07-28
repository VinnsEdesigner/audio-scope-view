import * as React from "react";

interface DeleteConfirmationDialogProperties {
  isOpen: boolean;
  recordingName?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DeleteConfirmationDialog({
  isOpen: _isOpen,
  recordingName,
  onConfirm,
  onCancel,
  isLoading,
}: DeleteConfirmationDialogProperties) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} onKeyDown={undefined} />
      <div className="relative bg-[#27272a] border border-white/10 rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Delete Recording</h2>
        <p className="text-sm text-[#a1a1aa] mb-4">
          Are you sure you want to delete{" "}
          <span className="text-white font-medium">&quot;{recordingName}&quot;</span>? This action
          cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-[#a1a1aa] hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
