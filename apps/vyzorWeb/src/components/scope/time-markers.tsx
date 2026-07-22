/**
 * TimeMarkers - Time scale markers for oscilloscope display
 * Shows time divisions at the bottom of the waveform display
 */

import { styled, Text } from "tamagui";
import { useTheme } from "@/hooks";

const MarkerContainer = styled("div", {
  position: "absolute",
  bottom: 4,
  left: 0,
  right: 0,
  height: 16,
  pointerEvents: "none",
});

interface TimeMarkersProperties {
  width: number;
  height: number;
  timeScale?: number;
  divisions?: number;
}

function formatTime(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms >= 1) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms * 1000).toFixed(0)}μs`;
}

export function TimeMarkers({
  width,
  height: _height,
  timeScale = 1,
  divisions = 10,
}: TimeMarkersProperties): React.ReactElement {
  const theme = useTheme();
  const textColor = theme === "dark" ? "oklch(0.65 0 0)" : "oklch(0.45 0 0)";

  const markers: React.ReactNode[] = [];
  const totalTime = timeScale * 1000; // ms

  for (let index = 0; index <= divisions; index++) {
    const x = (index / divisions) * (width - 20) + 10;
    const time = (index / divisions) * totalTime;

    markers.push(
      <div
        key={index}
        style={{
          position: "absolute",
          bottom: 0,
          left: x,
          transform: "translateX(-50%)",
        }}
      >
        {/* Tick mark */}
        <div
          style={{
            width: 1,
            height: 4,
            backgroundColor: textColor,
            margin: "0 auto",
          }}
        />
        {/* Time label */}
        <Text fontSize={8} color={textColor} lineHeight={10} textAlign="center" minWidth={32}>
          {formatTime(time)}
        </Text>
      </div>,
    );
  }

  return <MarkerContainer>{markers}</MarkerContainer>;
}
