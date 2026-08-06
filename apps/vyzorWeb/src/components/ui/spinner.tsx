import * as React from "react";

export interface SpinnerProperties {
  size?: number;
  className?: string;
}

export function Spinner({ size, className = "" }: SpinnerProperties): React.ReactElement {
  // Responsive default size: smaller on mobile, larger on desktop
  const defaultSize = size ?? (globalThis.window?.innerWidth < 640 ? 32 : 48);
  const actualSize = size ?? defaultSize;
  const borderWidth = Math.max(2, Math.round(actualSize / 8));

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`relative inline-flex items-center justify-center ${className}`}
      style={className ? undefined : { width: actualSize, height: actualSize }}
    >
      <style>{`
        @keyframes block-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-block-spin {
          animation: block-spin 1.5s linear infinite;
        }
      `}</style>
      <div
        className="absolute inset-0 rounded-full border-2 border-current animate-block-spin"
        style={{ borderWidth }}
      />
    </div>
  );
}
