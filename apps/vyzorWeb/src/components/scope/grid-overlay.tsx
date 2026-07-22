/**
 * GridOverlay - Oscilloscope grid rendered as SVG overlay
 * Simple neutral gray grid lines with center crosshair
 */

import { styled, Stack } from "tamagui";
import { useTheme } from "@/hooks";

const GridWrapper = styled(Stack, {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
});

interface GridOverlayProperties {
  width: number;
  height: number;
  divisionsX?: number;
  divisionsY?: number;
}

export function GridOverlay({
  width,
  height,
  divisionsX = 10,
  divisionsY = 8,
}: GridOverlayProperties): React.ReactElement {
  const theme = useTheme();
  const gridColor = theme === "dark" ? "oklch(0.25 0 0)" : "oklch(0.85 0 0)";
  const centerColor = theme === "dark" ? "oklch(0.35 0 0)" : "oklch(0.75 0 0)";

  const elements: React.ReactNode[] = [];

  // Vertical lines
  for (let index = 0; index <= divisionsX; index++) {
    const x = (index / divisionsX) * width;
    const isCenter = index === Math.floor(divisionsX / 2);
    elements.push(
      <line
        key={`v-${index}`}
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={isCenter ? centerColor : gridColor}
        strokeWidth={isCenter ? 1.5 : 0.5}
      />
    );
  }

  // Horizontal lines
  for (let index = 0; index <= divisionsY; index++) {
    const y = (index / divisionsY) * height;
    const isCenter = index === Math.floor(divisionsY / 2);
    elements.push(
      <line
        key={`h-${index}`}
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke={isCenter ? centerColor : gridColor}
        strokeWidth={isCenter ? 1.5 : 0.5}
      />
    );
  }

  return (
    <GridWrapper>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {elements}
      </svg>
    </GridWrapper>
  );
}
