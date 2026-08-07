import * as React from "react";

interface LogoProperties {
  className?: string;
  size?: "small" | "medium" | "large";
}

export function Logo({ className = "", size = "medium" }: LogoProperties): React.ReactElement {
  const dimensions = {
    small: { width: 80, height: 32 },
    medium: { width: 160, height: 64 },
    large: { width: 240, height: 96 },
  };

  const { width, height } = dimensions[size];

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 300 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="300" height="120" fill="#000000" />
      <text
        x="10"
        y="100"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="100"
        fontWeight="900"
        fill="#e11d48"
      >
        A
      </text>
      <path d="M 25 55 Q 40 45, 55 55 T 85 55" stroke="#ffffff" strokeWidth="3" fill="none" />
      <text
        x="100"
        y="100"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="100"
        fontWeight="900"
        fill="#ffffff"
      >
        S
      </text>
      <text
        x="185"
        y="100"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="100"
        fontWeight="900"
        fill="#ffffff"
      >
        V
      </text>
    </svg>
  );
}
