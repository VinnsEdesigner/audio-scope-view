import * as React from "react";

interface TestModeIconProperties extends React.SVGAttributes<SVGElement> {
  size?: number;
}

export function TestModeIcon({ size = 16, ...properties }: TestModeIconProperties): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...properties}
    >
      {/* Audio waveform bars */}
      <rect x="2" y="9" width="3" height="6" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="7" y="6" width="3" height="12" rx="1" fill="currentColor" opacity="0.8" />
      <rect x="12" y="3" width="3" height="18" rx="1" fill="currentColor" />
      <rect x="17" y="6" width="3" height="12" rx="1" fill="currentColor" opacity="0.8" />
      <rect x="22" y="9" width="3" height="6" rx="1" fill="currentColor" opacity="0.6" />
      
      {/* Small "T" badge in top right */}
      <circle cx="19" cy="5" r="4" fill="#10b981" />
      <text 
        x="19" 
        y="8" 
        textAnchor="middle" 
        fill="white" 
        fontSize="6" 
        fontWeight="bold" 
        fontFamily="system-ui, sans-serif"
      >
        T
      </text>
    </svg>
  );
}
