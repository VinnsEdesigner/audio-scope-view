import * as React from "react";
import { useUIStore, type WaveformColor } from "@/store";
import { computeSpectrum, toDecibels, triggeredWindow } from "@/lib/scope-dsp";

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
  /** Full-resolution frame used for triggering and spectrum analysis. */
  analysisFrame?: Float32Array;
  sampleRate?: number;
  forwardedRef?: React.RefObject<HTMLCanvasElement | null>;
}

interface DrawSpectrumOptions {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  glow: boolean;
  data: ArrayLike<number>;
  sampleRate: number;
}

/**
 * Standard analyser palette: low magnitude = deep blue, rising through cyan,
 * green and yellow to red at full scale.
 */
function spectrumColor(normalized: number): string {
  const t = Math.min(1, Math.max(0, normalized));
  const stops: [number, [number, number, number]][] = [
    [0, [12, 24, 92]],
    [0.25, [0, 140, 200]],
    [0.5, [0, 190, 110]],
    [0.75, [235, 205, 40]],
    [1, [230, 45, 30]],
  ];
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let index = 0; index < stops.length - 1; index++) {
    if (t >= stops[index][0] && t <= stops[index + 1][0]) {
      lower = stops[index];
      upper = stops[index + 1];
      break;
    }
  }
  const span = upper[0] - lower[0] || 1;
  const ratio = (t - lower[0]) / span;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * ratio);
  return `rgb(${mix(lower[1][0], upper[1][0])}, ${mix(lower[1][1], upper[1][1])}, ${mix(lower[1][2], upper[1][2])})`;
}

function drawSpectrum({
  context,
  width,
  height,
  glow,
  data,
  sampleRate,
}: DrawSpectrumOptions): void {
  if (!data || data.length < 8) return;

  const { magnitudes, binHz } = computeSpectrum(data, sampleRate);
  if (magnitudes.length === 0) return;

  const maxFrequency = Math.min(sampleRate / 2, 20_000);
  const maxBin = Math.max(1, Math.min(magnitudes.length - 1, Math.floor(maxFrequency / binHz)));
  const floorDatabase = -80;

  context.save();
  const barWidth = Math.max(1, width / maxBin);

  for (let bin = 1; bin <= maxBin; bin++) {
    const database = toDecibels(magnitudes[bin], floorDatabase);
    const normalized = (database - floorDatabase) / -floorDatabase;
    const barHeight = Math.max(0, normalized) * (height - 18);
    const x = ((bin - 1) / maxBin) * width;
    const barColor = spectrumColor(normalized);
    context.fillStyle = barColor;
    if (glow) {
      context.shadowColor = barColor;
      context.shadowBlur = 6;
    }
    context.fillRect(x, height - 18 - barHeight, barWidth, barHeight);
  }
  context.restore();

  // Frequency axis labels
  context.save();
  context.fillStyle = "rgba(255,255,255,0.5)";
  context.font = "10px ui-monospace, monospace";
  for (let step = 0; step <= 4; step++) {
    const ratio = step / 4;
    const frequency = ratio * maxBin * binHz;
    const label =
      frequency >= 1000 ? `${(frequency / 1000).toFixed(1)}k` : `${Math.round(frequency)}`;
    context.fillText(label, Math.min(width - 22, ratio * width + 2), height - 5);
  }
  context.restore();
}

export function ScopeCanvas({
  ...(0 as never),
}: never);
  waveformData,
  isPaused = false,
  analysisFrame,
  sampleRate = 48_000,
  forwardedRef,
}: ScopeCanvasProperties) {
  const {
    showGrid,
    glow,
    autoScale,
    invert,
    waveformColor,
    verticalGain,
    scopeView,
    triggerEnabled,
    triggerEdge,
    triggerLevel,
    triggerMode,
    triggerHoldoff,
  } = useUIStore();

  const internalCanvasReference = React.useRef<HTMLCanvasElement>(null);
  const containerReference = React.useRef<HTMLDivElement>(null);
  const setTriggerLevel = useUIStore((state) => state.setTriggerLevel);
  const isDraggingReference = React.useRef(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const effectiveCanvasReference = forwardedRef ?? internalCanvasReference;

  const waveformDataReference = React.useRef(waveformData);
  React.useEffect(() => {
    waveformDataReference.current = waveformData;
  }, [waveformData]);

  const analysisFrameReference = React.useRef(analysisFrame);
  React.useEffect(() => {
    analysisFrameReference.current = analysisFrame;
  }, [analysisFrame]);

  const settings = {
    glow,
    autoScale,
    invert,
    waveformColor,
    verticalGain,
    scopeView,
    triggerEnabled,
    triggerEdge,
    triggerLevel,
    triggerMode,
    triggerHoldoff,
    sampleRate,
    isPaused,
  };
  const settingsReference = React.useRef(settings);
  settingsReference.current = settings;

  /** Last successfully triggered frame — held in "normal"/"single" mode. */
  const heldFrameReference = React.useRef<number[]>([]);
  const singleArmedReference = React.useRef(true);

  /** Smoothed max value for auto-scale to reduce jitter. Uses exponential moving average. */
  const smoothedMaxValueReference = React.useRef(0.01);

  const draggingReference = React.useRef(isDragging);
  draggingReference.current = isDragging;

  React.useEffect(() => {
    if (triggerMode === "single") singleArmedReference.current = true;
  }, [triggerMode, triggerEnabled, triggerLevel, triggerEdge]);

  const isFrozen = isPaused;

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

      if (width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        context.scale(dpr, dpr);
      }

      context.fillStyle = "#111820";
      context.fillRect(0, 0, width, height);

      const {
        glow,
        autoScale,
        invert,
        waveformColor,
        verticalGain,
        scopeView,
        triggerEnabled,
        triggerEdge,
        triggerLevel,
        triggerMode,
        triggerHoldoff,
        sampleRate,
        isPaused,
      } = settingsReference.current;

      const waveformColorValue = WAVEFORM_COLORS[waveformColor] ?? WAVEFORM_COLORS.cyan;
      const liveFrame = waveformDataReference.current;
      const fullFrame = analysisFrameReference.current;

      if (scopeView === "spectrum") {
        drawSpectrum({
          context,
          width,
          height,
          glow,
          data: fullFrame && fullFrame.length > 0 ? fullFrame : liveFrame,
          sampleRate,
        });
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      // ---- Trigger --------------------------------------------------------
      let frame: number[] = liveFrame;

      if (triggerEnabled && !isPaused && liveFrame.length > 0) {
        const source = fullFrame && fullFrame.length > liveFrame.length ? fullFrame : liveFrame;
        const windowSize = Math.min(liveFrame.length, source.length);
        const armed = triggerMode !== "single" || singleArmedReference.current;

        const aligned = armed
          ? triggeredWindow(source, windowSize, {
              edge: triggerEdge,
              level: triggerLevel,
              holdoff: triggerHoldoff,
            })
          : undefined;

        if (aligned) {
          frame = aligned;
          heldFrameReference.current = aligned;
          if (triggerMode === "single") singleArmedReference.current = false;
        } else if (triggerMode === "auto") {
          frame = liveFrame;
        } else {
          frame = heldFrameReference.current;
        }
      } else if (isPaused) {
        frame = heldFrameReference.current.length > 0 ? heldFrameReference.current : liveFrame;
      }

      const centerY = height / 2;
      const fullScale = (height / 2) * 0.9;

      // ---- Trigger level marker ------------------------------------------
      if (triggerEnabled) {
        const clampedLevel = Math.max(-1, Math.min(1, triggerLevel));
        const levelY = centerY - clampedLevel * fullScale;
        const active = draggingReference.current;
        const markerColor = active ? "#f97316" : "rgba(249, 115, 22, 0.75)";

        context.save();
        context.strokeStyle = markerColor;
        context.setLineDash([6, 5]);
        context.lineWidth = active ? 2 : 1;
        context.beginPath();
        context.moveTo(0, levelY);
        context.lineTo(width - 46, levelY);
        context.stroke();
        context.setLineDash([]);

        // Right-edge drag handle with the level value.
        const handleWidth = 44;
        const handleHeight = 16;
        const handleY = Math.max(0, Math.min(height - handleHeight, levelY - handleHeight / 2));
        context.fillStyle = markerColor;
        context.fillRect(width - handleWidth, handleY, handleWidth, handleHeight);
        context.fillStyle = "#111820";
        context.font = "10px ui-monospace, monospace";
        context.textBaseline = "middle";
        context.fillText(clampedLevel.toFixed(2), width - handleWidth + 5, handleY + handleHeight / 2);

        // Edge arrow on the left showing rising / falling / auto.
        const arrowX = 10;
        context.strokeStyle = markerColor;
        context.lineWidth = 1.5;
        context.beginPath();
        if (triggerEdge === "falling") {
          context.moveTo(arrowX - 4, levelY - 6);
          context.lineTo(arrowX, levelY + 6);
          context.lineTo(arrowX + 4, levelY - 6);
        } else {
          context.moveTo(arrowX - 4, levelY + 6);
          context.lineTo(arrowX, levelY - 6);
          context.lineTo(arrowX + 4, levelY + 6);
        }
        context.stroke();

        // Trigger point (horizontal position of the aligned edge).
        context.strokeStyle = "rgba(249, 115, 22, 0.35)";
        context.setLineDash([3, 5]);
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(0, height);
        context.stroke();
        context.restore();
      }

      if (frame.length > 1) {
        context.save();

        if (glow) {
          context.shadowColor = waveformColorValue;
          context.shadowBlur = 8;
        }

        context.beginPath();
        context.strokeStyle = waveformColorValue;
        context.lineWidth = 2;
        context.lineJoin = "round";
        context.lineCap = "round";

        let pixelsPerUnit = fullScale * verticalGain;
        let frameMaxValue = 0.01;
        for (const value of frame) {
          const absolute = Math.abs(value);
          if (absolute > frameMaxValue) frameMaxValue = absolute;
        }

        if (autoScale) {
          // Explicit user-enabled auto-scale only: smooth the peak so the trace
          // does not jump between frames.
          const alpha = 0.15;
          const previousMax = smoothedMaxValueReference.current;
          const newMax = Math.max(frameMaxValue, previousMax * 0.95);
          smoothedMaxValueReference.current = previousMax * (1 - alpha) + newMax * alpha;

          pixelsPerUnit = (fullScale * verticalGain) / smoothedMaxValueReference.current;
        } else {
          // No hidden gain: draw the signal exactly at its real amplitude.
          pixelsPerUnit = fullScale * verticalGain;
        }

        const sign = invert ? -1 : 1;
        for (let index = 0; index < frame.length; index++) {
          const x = (index / (frame.length - 1)) * width;
          const y = centerY - sign * frame[index] * pixelsPerUnit;

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
    <div ref={containerReference} className="absolute inset-0 bg-[#111820]">
      {}
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

      {}
      <canvas ref={effectiveCanvasReference} className="absolute inset-0 w-full h-full" />

      {}
      {triggerEnabled && scopeView !== "spectrum" && (
        <div
          className="absolute inset-0"
          style={{ cursor: isDragging ? "grabbing" : "ns-resize", touchAction: "none" }}
          onPointerDown={(event) => {
            (event.target as HTMLElement).setPointerCapture(event.pointerId);
            isDraggingReference.current = true;
            setIsDragging(true);
            setTriggerLevel(levelFromPointer(event, containerReference.current));
          }}
          onPointerMove={(event) => {
            if (!isDraggingReference.current) return;
            setTriggerLevel(levelFromPointer(event, containerReference.current));
          }}
          onPointerUp={() => {
            isDraggingReference.current = false;
            setIsDragging(false);
          }}
          onPointerCancel={() => {
            isDraggingReference.current = false;
            setIsDragging(false);
          }}
          onDoubleClick={() => setTriggerLevel(0)}
        />
      )}

      {}
      {isFrozen && (
        <div className="absolute top-3 left-3 bg-white text-[#09090b] px-2 py-1 rounded text-[11px] font-semibold">
          HOLD
        </div>
      )}
    </div>
  );
}
