import * as React from "react";
import { styled, XStack } from "tamagui";

const SpinnerContainer = styled(XStack, {
  position: "relative",
  alignItems: "center",
  justifyContent: "center",
});

const SpinnerRing = styled(XStack, {
  position: "absolute",
  inset: 0,
  borderRadius: "$3",
});

/**
 * Mini block spinner - rotating outer ring only.
 * Standard loading indicator for all UI components.
 */
export interface SpinnerProperties {
  size?: number;
  className?: string;
}

export function Spinner({ size = 16, className }: SpinnerProperties): React.ReactElement {
  const borderWidth = Math.max(2, Math.round(size / 8));

  return (
    <SpinnerContainer
      className={className}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
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
      <SpinnerRing
        className="animate-block-spin"
        borderWidth={borderWidth}
        borderColor="$white"
        backgroundColor="transparent"
      />
    </SpinnerContainer>
  );
}
