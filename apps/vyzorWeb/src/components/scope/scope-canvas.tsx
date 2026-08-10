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
          color: waveformColorValue,
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
        const levelY = centerY - triggerLevel * fullScale;
        context.save();
        context.strokeStyle = "rgba(255,255,255,0.35)";
        context.setLineDash([4, 4]);
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(0, levelY);
        context.lineTo(width, levelY);
        context.stroke();
        context.restore();
      }

      if (frame.length > 1) {
        context.save();

        if (glow) {
          context.shadowColor = waveformColorValue;
          context.shadowBlur = 8;
        }

        if (invert) {
          context.scale(1, -1);
          context.translate(0, -height);
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
          // Apply exponential moving average for smooth auto-scaling
          // This reduces jitter when signal levels change slightly between frames
          const alpha = 0.15; // Smoothing factor - higher = faster response, lower = smoother
          const previousMax = smoothedMaxValueReference.current;
          const newMax = Math.max(frameMaxValue, previousMax * 0.95); // Never let max drop below 95% of previous (peak hold)
          smoothedMaxValueReference.current = previousMax * (1 - alpha) + newMax * alpha;

          pixelsPerUnit = (fullScale * verticalGain) / smoothedMaxValueReference.current;
        } else {
          // When autoScale is off, ensure minimum display gain so small signals remain visible.
          // Calculate what gain would fill 80% of the display at current verticalGain.
          const minGainNeeded = frameMaxValue > 0 ? (fullScale * 0.8) / frameMaxValue : fullScale;
          // Use whichever is larger: user-set verticalGain or the minimum needed to see the signal
          const effectiveGain = Math.max(verticalGain, minGainNeeded / fullScale);
          pixelsPerUnit = fullScale * effectiveGain;
        }

        for (let index = 0; index < frame.length; index++) {
          const x = (index / (frame.length - 1)) * width;
          const y = centerY - frame[index] * pixelsPerUnit;

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
      {isFrozen && (
        <div className="absolute top-3 left-3 bg-white text-[#09090b] px-2 py-1 rounded text-[11px] font-semibold">
          HOLD
        </div>
      )}
    </div>
  );
}
