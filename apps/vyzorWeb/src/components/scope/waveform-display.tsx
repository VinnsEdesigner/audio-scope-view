/**
 * WaveformDisplay - Canvas-based oscilloscope waveform visualization
 * Renders audio samples as a time-domain trace using HTML5 Canvas
 */

import { useEffect, useRef } from "react";
import { styled, XStack, YStack, Text, Stack } from "tamagui";
import { useWaveformStore } from "@/store";
import type { WaveformColor } from "@/store/ui-store";
import { GridOverlay } from "./grid-overlay";
import { TriggerIndicator } from "./trigger-indicator";
import { TimeMarkers } from "./time-markers";

// Color mapping for waveform trace (blue, red, teal)
const TRACE_COLORS: Record<WaveformColor, string> = {
  blue: "#3b82f6",
  red: "#ef4444",
  teal: "#14b8a6",
};

const WaveformContainer = styled(YStack, {
  backgroundColor: "$scopeBackground",
  borderRadius: "$md",
  overflow: "hidden",
  position: "relative",
});

const CanvasWrapper = styled(Stack, {
  width: "100%",
  height: "100%",
});

const OverlayContainer = styled(XStack, {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: "none",
});

interface WaveformDisplayProperties {
  width?: number;
  height?: number;
  showGrid?: boolean;
  showTrigger?: boolean;
  showTimeMarkers?: boolean;
  waveformColor?: WaveformColor;
}

export function WaveformDisplay({
  width = 800,
  height = 300,
  showGrid = true,
  showTrigger = true,
  showTimeMarkers = true,
  waveformColor = "blue",
}: WaveformDisplayProperties): React.ReactElement {
  const canvasReference = useRef<HTMLCanvasElement>(null);
  const containerReference = useRef<HTMLDivElement>(null);
  const waveform = useWaveformStore((s) => s.waveform);

  const strokeColor = TRACE_COLORS[waveformColor];

  useEffect(() => {
    const canvas = canvasReference.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    context.scale(dpr, dpr);

    // Clear canvas
    context.clearRect(0, 0, width, height);

    // Draw waveform if data available
    if (waveform?.samples && waveform.samples.length > 0) {
      const samples = waveform.samples;
      const centerY = height / 2;
      const amplitudeScale = height * 0.4;

      context.strokeStyle = strokeColor;
      context.lineWidth = 2;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();

      const step = width / (samples.length - 1);

      for (const [index, sample] of samples.entries()) {
        const x = index * step;
        const y = centerY - sample * amplitudeScale;

        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }

      context.stroke();
    }
  }, [waveform, width, height, strokeColor]);

  return (
    <WaveformContainer width={width} height={height} ref={containerReference}>
      <CanvasWrapper>
        <canvas ref={canvasReference} style={{ width: "100%", height: "100%", display: "block" }} />
      </CanvasWrapper>

      <OverlayContainer>
        {showGrid && <GridOverlay width={width} height={height} />}
        {showTrigger && <TriggerIndicator width={width} height={height} />}
        {showTimeMarkers && <TimeMarkers width={width} height={height} />}
      </OverlayContainer>

      {!waveform && (
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          justifyContent="center"
          alignItems="center"
        >
          <Text color="$mutedForeground" fontSize="$sm">
            Waiting for waveform data...
          </Text>
        </YStack>
      )}
    </WaveformContainer>
  );
}
