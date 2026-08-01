import * as React from "react";
import { useUIStore, type WaveformColor } from "@/store";

const WAVEFORM_COLORS: Record<WaveformColor, string> = {
  cyan: "#22d3ee",
  blue: "#3b82f6",
  purple: "#a855f7",
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
};

interface ScopeCanvasProperties {
  waveformData: number[];
  isCapturing?: boolean;
  isPaused?: boolean;
  forwardedRef?: React.RefObject<HTMLCanvasElement | null>;
}

export function ScopeCanvas({
  waveformData,
  isCapturing = false,
  isPaused = false,
  forwardedRef,
}: ScopeCanvasProperties) {
  const { showGrid, glow, autoScale, invert, waveformColor, verticalGain } = useUIStore();

  const internalCanvasReference = React.useRef<HTMLCanvasElement>(null);
  const containerReference = React.useRef<HTMLDivElement>(null);

  // Use forwarded ref if provided, otherwise use internal ref
  const effectiveCanvasReference = forwardedRef ?? internalCanvasReference;

  // Store waveform data in ref for RAF loop access
  const waveformDataRef = React.useRef(waveformData);
  React.useEffect(() => {
    waveformDataRef.current = waveformData;
  }, [waveformData]);

  // Store settings in refs to avoid effect re-runs
  const settingsRef = React.useRef({
    glow,
    autoScale,
    invert,
    waveformColor,
    verticalGain,
  });
  React.useEffect(() => {
    settingsRef.current = { glow, autoScale, invert, waveformColor, verticalGain };
  }, [glow, autoScale, invert, waveformColor, verticalGain]);

  const isFrozen = isPaused;

  // RAF loop for continuous 60fps drawing
  React.useEffect(() => {
    const canvas = effectiveCanvasReference.current;
    const container = containerReference.current;
    if (!canvas || !container) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrameId: number;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Skip if canvas has no size
      if (width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      const dpr = window.devicePixelRatio || 1;

      // Set canvas size accounting for device pixel ratio
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        context.scale(dpr, dpr);
      }

      // Clear canvas
      context.fillStyle = "#111820";
      context.fillRect(0, 0, width, height);

      const waveformData = waveformDataRef.current;
      const { glow, autoScale, invert, waveformColor, verticalGain } = settingsRef.current;
      const waveformColorValue = WAVEFORM_COLORS[waveformColor] ?? WAVEFORM_COLORS.cyan;

      // Draw waveform if we have data
      if (waveformData.length > 0) {
        context.save();

        // Apply glow effect
        if (glow) {
          context.shadowColor = waveformColorValue;
          context.shadowBlur = 8;
        }

        // Apply invert
        if (invert) {
          context.scale(1, -1);
          context.translate(0, -height);
        }

        context.beginPath();
        context.strokeStyle = waveformColorValue;
        context.lineWidth = 2;
        context.lineJoin = "round";
        context.lineCap = "round";

        const centerY = height / 2;

        // Auto-scale: fit waveform to canvas
        let scale = verticalGain;
        if (autoScale) {
          const maxValue = Math.max(...waveformData.map((v: number) => Math.abs(v)), 0.01);
          scale = ((height / 2) * 0.8 * verticalGain) / maxValue;
        }

        // Draw waveform
        for (let index = 0; index < waveformData.length; index++) {
          const x = (index / (waveformData.length - 1)) * width;
          const y = centerY + waveformData[index] * scale;

          if (index === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }

        context.stroke();
        context.restore();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [effectiveCanvasReference]);

  // Resize observer
  React.useEffect(() => {
    const canvas = effectiveCanvasReference.current;
    const container = containerReference.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [effectiveCanvasReference]);

  return (
    <div ref={containerReference} className="flex-1 relative bg-[#111820] min-h-0">
      {/* Grid overlay */}
      {showGrid && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(120, 160, 170, 0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(120, 160, 170, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: "10% 12.5%",
          }}
        />
      )}

      {/* Canvas */}
      <canvas ref={effectiveCanvasReference} className="absolute inset-0 w-full h-full" />

      {/* Hold badge */}
      {(isCapturing || isFrozen) && (
        <div className="absolute top-3 left-3 bg-white text-[#09090b] px-2 py-1 rounded text-[11px] font-semibold">
          HOLD
        </div>
      )}
    </div>
  );
}
