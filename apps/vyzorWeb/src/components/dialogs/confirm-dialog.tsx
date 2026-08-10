import * as React from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProperties {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDialogProperties) {
  if (!isOpen) return;

  const getVariantStyles = () => {
    switch (variant) {
      case "danger": {
        return {
          confirmButton: "bg-gray-500 hover:bg-gray-600 text-white",
          icon: "text-gray-400",
          iconBg: "bg-gray-500/10",
        };
      }
      case "warning": {
        return {
          confirmButton: "bg-gray-500 hover:bg-gray-600 text-white",
          icon: "text-gray-400",
          iconBg: "bg-gray-500/10",
        };
      }
      default: {
        return {
          confirmButton: "bg-gray-500 hover:bg-gray-600 text-white",
          icon: "text-gray-400",
          iconBg: "bg-gray-500/10",
        };
      }
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} onKeyDown={undefined} />
      <div className="relative bg-bg-secondary border border-border rounded-lg shadow-xl w-full max-w-sm p-6">
        <div className="flex items-start gap-4 mb-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${styles.iconBg}`}
          >
            <AlertTriangle size={20} className={styles.icon} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground mb-1">{title}</h2>
            <p className="text-sm text-text-secondary whitespace-pre-line">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-foreground transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 ${styles.confirmButton}`}
          >
            {isLoading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
