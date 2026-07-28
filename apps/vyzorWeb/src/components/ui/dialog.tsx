/**
 * Dialog - Reusable modal dialog component
 * Centered popup with overlay backdrop
 */

import * as React from "react";
import { X } from "lucide-react";

interface DialogProperties {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-md",
}: DialogProperties): React.ReactElement | null {
  // Close on Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when dialog is open
  React.useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
      {/* Overlay backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Dialog box */}
      <div
        className={`relative w-full ${maxWidth} bg-bg-secondary border border-border-subtle rounded-xl shadow-2xl animate-in zoom-in-95 duration-200`}
        style={{
          animation: "slideUp 0.3s ease",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle">
          <h2 className="text-lg font-semibold text-foreground tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:text-foreground hover:bg-bg-hover transition-all"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">{children}</div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

// Dialog Footer helper for consistent button layout
export function DialogFooter({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={`flex justify-end gap-3 px-6 py-4 border-t border-border-subtle bg-bg-elevated ${className}`}
    >
      {children}
    </div>
  );
}
