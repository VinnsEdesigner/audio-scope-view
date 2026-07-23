/**
 * ScopeCanvas - Main waveform display canvas
 */

import { useEffect, useRef, useState } from "react";
import { styled, XStack, Text, Stack } from "tamagui";

const CanvasWrapper = styled(Stack, {
  flex: 1,
  backgroundColor: "$gray2",
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.06)",
  borderRadius: 12,
  overflow: "hidden",
});

const CanvasHeader = styled(XStack, {
  height: 40,
  borderBottomWidth: 1,
  borderBottomColor: "rgba(255, 255, 255, 0.06)",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 16,
  backgroundColor: "$gray3",
});

const CanvasLabel = styled(Text, {
  fontSize: 12,
  fontWeight: "500",
  color: "$gray11",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
});

const CanvasTime = styled(Text, {
  fontSize: 11,
  color: "$gray9",
  fontFamily: "monospace",
});

const CanvasContainer = styled(Stack, {
  flex: 1,
  position: "relative",
  backgroundColor: "#000",
});

interface ScopeCanvasProperties {
  width?: number;
  height?: number;
  showGrid?: boolean;
  waveformColor?: string;
  isRunning?: boolean;
}

export function ScopeCanvas({
  width = 800,
  height = 400,
  showGrid = true,
  waveformColor = "#14b8a6",
  isRunning = true,
}: ScopeCanvasProperties): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      const w = rect.width;
      const h = rect.height;

      // Clear
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      // Grid
      if (showGrid) {
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;

        // Vertical lines (10 divisions)
        for (let i = 0; i <= 10; i++) {
          ctx.beginPath();
          ctx.moveTo((w * i) / 10, 0);
          ctx.lineTo((w * i) / 10, h);
          ctx.stroke();
        }

        // Horizontal lines (8 divisions)
        for (let i = 0; i <= 8; i++) {
          ctx.beginPath();
          ctx.moveTo(0, (h * i) / 8);
          ctx.lineTo(w, (h * i) / 8);
          ctx.stroke();
        }

        // Center lines
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
      }

      // Waveform (simulated)
      if (isRunning) {
        const centerY = h / 2;
        const amplitude = h * 0.3;

        ctx.strokeStyle = waveformColor;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const time = Date.now() / 1000;

        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const t = (x / w) * Math.PI * 8 + time * 2;
          const y = centerY + Math.sin(t) * amplitude * 0.8 + Math.sin(t * 2.5) * amplitude * 0.2;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [showGrid, waveformColor, isRunning]);

  return (
    <CanvasWrapper>
      <CanvasHeader>
        <CanvasLabel>Waveform</CanvasLabel>
        <CanvasTime>48.0 kHz</CanvasTime>
      </CanvasHeader>
      <CanvasContainer>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
          }}
        />
      </CanvasContainer>
    </CanvasWrapper>
  );
}
