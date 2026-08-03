import * as React from "react";

export interface AnchoredDialogProperties {
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
}: AnchoredDialogProperties): React.ReactElement | undefined {
  const dialogReference = React.useRef<HTMLDivElement>(null);
  const pointerReference = React.useRef<HTMLDivElement>(null);
  const [isPositioned, setIsPositioned] = React.useState(false);

  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (!isOpen) {
      setIsPositioned(false);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen || !dialogReference.current) return;

    if (!anchorRect) {
      setIsPositioned(true);
      return;
    }

    const dialog = dialogReference.current;
    const pointer = pointerReference.current;
    const viewportHeight = window.innerHeight;

    const buttonTop = anchorRect.top;
    const buttonHeight = anchorRect.height;

    const left = 92;

    requestAnimationFrame(() => {
      if (!dialog) return;
      const dialogRect = dialog.getBoundingClientRect();

      let top = buttonTop + buttonHeight / 2 - dialogRect.height / 2;

      if (top < 16) top = 16;
      if (top + dialogRect.height > viewportHeight - 16) {
        top = viewportHeight - dialogRect.height - 16;
      }

      dialog.style.left = `${left}px`;
      dialog.style.top = `${top}px`;

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
      {}
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onClose} />

      {}
      <div
        ref={dialogReference}
        className={`absolute pointer-events-auto ${maxWidth} ${className}`}
        style={{
          left: "92px",
          top: "100px",
          opacity: isPositioned ? 1 : 0,
          transition: "opacity 0.1s ease-out",
        }}
      >
        {}
        <div
          ref={pointerReference}
          className="absolute w-0 h-0 pointer-events-none"
          style={{
            left: -12,
            borderTop: "10px solid transparent",
            borderBottom: "10px solid transparent",
            borderRight: "12px solid hsl(var(--bg-secondary))",
            filter: "drop-shadow(-1px 0 1px rgba(0,0,0,0.15))",
          }}
        />

        {}
        <div className="bg-bg-secondary border border-border-subtle rounded-xl shadow-2xl overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
