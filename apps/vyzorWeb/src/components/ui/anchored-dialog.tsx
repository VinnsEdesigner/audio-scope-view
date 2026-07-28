import * as React from "react";

export interface AnchoredDialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
}

export function AnchoredDialog({
  isOpen,
  onClose,
  children,
  maxWidth = "max-w-[420px]",
  className = "",
}: AnchoredDialogProps): React.ReactElement | undefined {
  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return undefined;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/80">
      {/* Backdrop - clicking closes dialog */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Centered Dialog */}
      <div
        className={`relative ${maxWidth} w-full ${className}`}
      >
        <div className="bg-bg-secondary border border-border-subtle rounded-xl shadow-2xl overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

// Hook to track anchor element ref (kept for compatibility)
export function useAnchoredDialog() {
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);

  const openAtCurrentTarget = React.useCallback((event: React.MouseEvent) => {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setAnchorRect(rect);
  }, []);

  const close = React.useCallback(() => {
    setAnchorRect(null);
  }, []);

  return {
    anchorRect,
    openAtCurrentTarget,
    close,
  };
}
