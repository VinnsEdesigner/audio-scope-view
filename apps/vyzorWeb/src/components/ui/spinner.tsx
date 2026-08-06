import * as React from "react";

/**
 * Mini block spinner - rotating outer ring only.
 * Standard loading indicator for all UI components.
 */
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
      <div
        className="absolute inset-0 rounded-[--radius-md] animate-block-spin"
        style={{
          borderWidth: `${borderWidth}px`,
          borderStyle: "solid",
          borderColor: "#ffffff",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
