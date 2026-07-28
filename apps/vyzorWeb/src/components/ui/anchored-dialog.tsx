import * as React from "react";
import { X } from "lucide-react";

export interface AnchoredDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  anchorRect?: DOMRect | null;
  maxWidth?: string;
  className?: string;
}

export function AnchoredDialog({
  isOpen,
  onClose,
  title,
  children,
  anchorRect,
  maxWidth = "max-w-md",
  className = "",
}: AnchoredDialogProps): React.ReactElement | undefined {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });

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

  // Calculate position based on anchor
  React.useEffect(() => {
    if (!isOpen || !anchorRect) return;

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Sidebar is 72px wide, so dialog should be at x = 72 (right edge of sidebar)
    const sidebarWidth = 72;
    const gap = 12; // Gap between sidebar and dialog
    const pointerSize = 10; // Size of the pointer triangle
    const estimatedDialogHeight = 300; // Estimated height before render
    const estimatedDialogWidth = 320; // Estimated width

    let top = anchorRect.top + anchorRect.height / 2 - estimatedDialogHeight / 2;
    let left = sidebarWidth + gap + pointerSize;

    // Clamp to viewport bounds
    if (top < 16) {
      top = 16;
    }
    if (top + estimatedDialogHeight > viewportHeight - 16) {
      top = viewportHeight - estimatedDialogHeight - 16;
    }

    // If dialog would go off the right edge, position to the left of the anchor
    if (left + estimatedDialogWidth > viewportWidth - 16) {
      left = anchorRect.left - estimatedDialogWidth - gap - pointerSize;
    }

    setPosition({ top, left });
  }, [isOpen, anchorRect]);

  if (!isOpen) return undefined;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onClose} />

      {/* Dialog positioned near anchor */}
      <div
        ref={dialogRef}
        className={`absolute pointer-events-auto ${maxWidth} ${className}`}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        {/* Pointer triangle pointing to the anchor */}
        {anchorRect && position.left > 0 && (
          <div
            className="absolute w-0 h-0 pointer-events-none"
            style={{
              // Position the pointer at the vertical center of the anchor button
              top: anchorRect.top + anchorRect.height / 2 - 10,
              left: -20,
              borderTop: "10px solid transparent",
              borderBottom: "10px solid transparent",
              borderRight: "20px solid hsl(var(--bg-secondary))",
              filter: "drop-shadow(-2px 0 2px rgba(0,0,0,0.1))",
            }}
          />
        )}

        {/* Dialog content - just wraps children, no header since child dialogs have their own */}
        <div className="bg-bg-secondary border border-border-subtle rounded-xl shadow-2xl overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

// Hook to track anchor element ref
export function useAnchoredDialog() {
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);
  const anchorRef = React.useRef<HTMLElement | null>(null);

  const openAtElement = React.useCallback((element: HTMLElement | null) => {
    if (element) {
      const rect = element.getBoundingClientRect();
      setAnchorRect(rect);
    } else {
      setAnchorRect(null);
    }
  }, []);

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
    anchorRef,
    openAtElement,
    openAtCurrentTarget,
    close,
  };
}
