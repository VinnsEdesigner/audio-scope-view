import * as React from "react";

export interface AnchoredDialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  anchorRect?: DOMRect | null;
  maxWidth?: string;
  className?: string;
}

export function AnchoredDialog({
  isOpen,
  onClose,
  children,
  anchorRect,
  maxWidth = "max-w-sm",
  className = "",
}: AnchoredDialogProps): React.ReactElement | undefined {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const pointerRef = React.useRef<HTMLDivElement>(null);
  const [isPositioned, setIsPositioned] = React.useState(false);

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

  // Reset positioned state when dialog closes
  React.useEffect(() => {
    if (!isOpen) {
      setIsPositioned(false);
    }
  }, [isOpen]);

  // Apply position and pointer directly to DOM elements
  React.useEffect(() => {
    if (!isOpen || !anchorRect || !dialogRef.current) return;

    const dialog = dialogRef.current;
    const pointer = pointerRef.current;
    const viewportHeight = window.innerHeight;
    
    // Capture values for RAF closure
    const buttonTop = anchorRect.top;
    const buttonHeight = anchorRect.height;

    // Fixed X: right of sidebar (72px) + gap (8px) + pointer (12px) = 92px
    const left = 92;
    
    // Get dialog height after first render
    requestAnimationFrame(() => {
      if (!dialog) return;
      const dialogRect = dialog.getBoundingClientRect();
      
      // Vertical center on anchor button
      let top = buttonTop + buttonHeight / 2 - dialogRect.height / 2;

      // Clamp to viewport
      if (top < 16) top = 16;
      if (top + dialogRect.height > viewportHeight - 16) {
        top = viewportHeight - dialogRect.height - 16;
      }

      // Apply dialog position
      dialog.style.left = `${left}px`;
      dialog.style.top = `${top}px`;
      
      // Position pointer relative to dialog - center on button
      if (pointer) {
        const buttonCenter = buttonTop + buttonHeight / 2;
        const pointerTop = buttonCenter - top - 10;
        pointer.style.top = `${pointerTop}px`;
      }
      
      setIsPositioned(true);
    });
  }, [isOpen, anchorRect]);

  if (!isOpen) return undefined;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onClose} />

      {/* Dialog - hidden until positioned */}
      <div
        ref={dialogRef}
        className={`absolute pointer-events-auto ${maxWidth} ${className}`}
        style={{ 
          left: '92px', 
          top: '100px',
          opacity: isPositioned ? 1 : 0,
          transition: 'opacity 0.1s ease-out',
        }}
      >
        {/* Pointer triangle - positioned via ref in useEffect */}
        <div
          ref={pointerRef}
          className="absolute w-0 h-0 pointer-events-none"
          style={{
            left: -12,
            borderTop: '10px solid transparent',
            borderBottom: '10px solid transparent',
            borderRight: '12px solid hsl(var(--bg-secondary))',
            filter: 'drop-shadow(-1px 0 1px rgba(0,0,0,0.15))',
          }}
        />

        {/* Dialog content */}
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
