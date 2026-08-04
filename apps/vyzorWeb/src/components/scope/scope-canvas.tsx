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
        if (autoScale) {
          let maxValue = 0.01;
          for (const value of frame) {
            const absolute = Math.abs(value);
            if (absolute > maxValue) maxValue = absolute;
          }
          pixelsPerUnit = (fullScale * verticalGain) / maxValue;
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
