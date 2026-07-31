import * as React from "react";

export interface SpinnerProperties {
  size?: number;
  className?: string;
}

export function Spinner({ size = 16, className = "" }: SpinnerProperties): React.ReactElement {
  const borderWidth = Math.max(2, Math.round(size / 8));

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <style>{`
        @keyframes block-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-block-spin {
          animation: block-spin 2s linear infinite;
        }
      `}</style>
      <div
        className="absolute inset-0 rounded border-2 border-white animate-block-spin"
        style={{ borderWidth }}
      />
    </div>
  );
}
