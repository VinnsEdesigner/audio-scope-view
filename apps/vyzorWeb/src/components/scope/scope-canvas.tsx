import * as React from "react";
import { useUIStore, type WaveformColor } from "@/store";
import { ensureDsp, getDsp } from "@/lib/dsp-loader";
import type { Spectrum } from "@audio-scope-view/dsp-wasm";
import {
  GLContext,
  ScopeRenderer,
  SpectrumRenderer,
  SpectrogramRenderer,
  GlyphRenderer,
  OverlayRenderer,
} from "@/lib/webgl";

/**
 * Normalized RGBA (0..1) for the active waveform color, used by the WebGL
 * renderers (which take floats, not CSS strings).
 */
const WAVEFORM_COLORS: Record<WaveformColor, [number, number, number]> = {
  cyan: [0.133, 0.827, 0.933],
  blue: [0.231, 0.510, 0.965],
  purple: [0.659, 0.333, 0.972],
  green: [0.133, 0.773, 0.369],
  orange: [0.976, 0.451, 0.086],
  red: [0.937, 0.267, 0.267],
};

/** Parse a "#rrggbb" hex string into normalized RGB. */
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

const SCOPE_BG: [number, number, number] = hexToRgb("#111820");

interface ScopeCanvasProperties {
  waveformData: number[];
  isCapturing?: boolean;
  isPaused?: boolean;
  /** Full-resolution frame used for triggering and spectrum analysis. */
  analysisFrame?: Float32Array;
  sampleRate?: number;
  forwardedRef?: React.RefObject<HTMLCanvasElement | null>;
}

/** Holds all WebGL renderer resources for one canvas (created once, reused). */
interface RendererBundle {
  ctx: GLContext;
  scope: ScopeRenderer;
  spectrum: SpectrumRenderer;
  spectrogram: SpectrogramRenderer;
  glyph: GlyphRenderer;
  overlay: OverlayRenderer;
}

function levelFromPointer(
  event: React.PointerEvent<HTMLDivElement>,
  container: HTMLDivElement | null,
): number {
  if (!container) return 0;
  const rect = container.getBoundingClientRect();
  if (rect.height === 0) return 0;
  const centerY = rect.height / 2;
  const fullScale = (rect.height / 2) * 0.9;
  const level = (centerY - (event.clientY - rect.top)) / fullScale;
  return Math.round(Math.max(-1, Math.min(1, level)) * 100) / 100;
}

/**
 * ScopeCanvas — WebGL2-rendered oscilloscope surface.
 *
 * Replaces the original Canvas2D path. All drawing (trace, spectrum bars,
 * spectrogram waterfall, trigger markers + level value text) goes through
 * the WebGL renderers in `@/lib/webgl`. The props surface is unchanged so
 * scope-page.tsx needs no edits. The internal rAF loop, store-driven
 * view/color/trigger reads, and the forwardedRef (used by ExportDialog's
 * canvas.toDataURL snapshot) are all preserved.
 *
 * WebGL2 is acquired with `preserveDrawingBuffer: true` so PNG export
 * (ExportDialog → useExport → canvas.toDataURL) captures a non-blank frame.
 * When WebGL2 is unavailable the component renders an empty surface (graceful
 * degradation) rather than crashing.
 */
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

  // Kick off the WASM DSP core load as soon as the scope mounts so it is ready
  // for the spectrum + trigger hot path. getDsp() in the draw loop picks it up
  // once loaded; until then the UI free-runs (no spectrum / no trigger align).
  React.useEffect(() => {
    void ensureDsp();
  }, []);

  React.useEffect(() => {
    const canvas = effectiveCanvasReference.current;
    const container = containerReference.current;
    if (!canvas || !container) return;

    // Acquire a WebGL2 context. Falls back to a no-op render when unavailable.
    const glCtx = GLContext.from(canvas);
    if (!glCtx) {
      console.warn("[scope-canvas] WebGL2 unavailable — rendering an empty surface.");
      return;
    }

    const bundle: RendererBundle = {
      ctx: glCtx,
      scope: new ScopeRenderer(glCtx),
      spectrum: new SpectrumRenderer(glCtx),
      spectrogram: new SpectrogramRenderer(glCtx),
      glyph: new GlyphRenderer(glCtx),
      overlay: new OverlayRenderer(glCtx),
    };
    const ok =
      bundle.scope.init() &&
      bundle.spectrum.init() &&
      bundle.spectrogram.init() &&
      bundle.glyph.init() &&
      bundle.overlay.init();
    if (!ok) {
      console.warn("[scope-canvas] WebGL2 renderer init failed — falling back.");
      glCtx.dispose();
      return;
    }

    let animationFrameId: number;
    let cssWidth = 0;
    let cssHeight = 0;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      const resized = glCtx.resize(width, height);
      if (resized) {
        bundle.scope.resize(glCtx.width, glCtx.height);
        bundle.overlay.resize(glCtx.width, glCtx.height);
        bundle.spectrogram.clear();
      }
      // Track CSS-pixel size for the spectrum rect + marker placement.
      cssWidth = width;
      cssHeight = height;

      const dpr = glCtx.dpr;
      const physW = glCtx.width;
      const physH = glCtx.height;
      const toPhys = (v: number) => v * dpr;

      glCtx.clearBackground(...SCOPE_BG);

      const {
        glow: glowOn,
        autoScale: autoScaleOn,
        invert: invertOn,
        waveformColor: wfColor,
        verticalGain: vGain,
        scopeView: view,
        triggerEnabled: trigOn,
        triggerEdge: trigEdge,
        triggerLevel: trigLevel,
        triggerMode: trigMode,
        triggerHoldoff: trigHoldoff,
        sampleRate: sr,
        isPaused: paused,
      } = settingsReference.current;

      const [r, g, b] = WAVEFORM_COLORS[wfColor] ?? WAVEFORM_COLORS.cyan;
      const traceColor: [number, number, number, number] = [r, g, b, 1];
      const liveFrame = waveformDataReference.current;
      const fullFrame = analysisFrameReference.current;
      const dsp = getDsp();

      // ---- Spectrum view -------------------------------------------------
      if (view === "spectrum") {
        const data = fullFrame && fullFrame.length > 0 ? fullFrame : liveFrame;
        if (dsp && data.length >= 8) {
          const spectrum = dsp.computeSpectrum(data, sr, "hann");
          bundle.spectrum.draw({
            magnitudesDb: spectrum.magnitudesDb,
            frequencies: spectrum.frequencies,
            sampleRate: sr,
            rect: { x: 0, y: 0, w: physW, h: physH },
          });
          drawSpectrumAxisLabels(bundle.glyph, spectrum, cssWidth, physH, dpr);
        }
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      // ---- Spectrogram view (waterfall) ---------------------------------
      if (view === "spectrogram") {
        const data = fullFrame && fullFrame.length > 0 ? fullFrame : liveFrame;
        if (dsp && data.length >= 256) {
          // One STFT slice per frame (config tuned for the waterfall).
          const sg = dsp.computeSpectrogram(data, sr, {
            windowSize: 512,
            overlap: 0.5,
            minFreq: 20,
            maxFreq: Math.min(sr / 2, 20_000),
          });
          bundle.spectrogram.pushSlice(sg);
        }
        bundle.spectrogram.draw({ data: { frequencies: new Float32Array(), timeBins: new Int32Array(0), magnitudes: [], sampleRate: sr, windowSize: 0, overlap: 0 }, rect: { x: 0, y: 0, w: physW, h: physH } });
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      // ---- Time (waveform) view -----------------------------------------
      // Trigger (unchanged logic: WASM core when available, else free-run).
      let frame: ArrayLike<number> = liveFrame;

      if (trigOn && !paused && liveFrame.length > 0) {
        const source = fullFrame && fullFrame.length > liveFrame.length ? fullFrame : liveFrame;
        const windowSize = Math.min(liveFrame.length, source.length);
        const armed = trigMode !== "single" || singleArmedReference.current;
        const aligned =
          armed && dsp
            ? dsp.triggeredWindow(source, windowSize, {
                edge: trigEdge,
                level: trigLevel,
                holdoff: trigHoldoff,
              }) ?? undefined
            : undefined;

        if (aligned) {
          frame = aligned;
          heldFrameReference.current = Array.from(aligned);
          if (trigMode === "single") singleArmedReference.current = false;
        } else if (trigMode === "auto") {
          frame = liveFrame;
        } else {
          frame = heldFrameReference.current;
        }
      } else if (paused) {
        frame = heldFrameReference.current.length > 0 ? heldFrameReference.current : liveFrame;
      }

      // Amplitude scaling — mirrors the Canvas2D path so the trace looks identical.
      const fullScale = (height / 2) * 0.9;
      let pixelsPerUnit = fullScale * vGain;
      let frameMaxValue = 0.01;
      for (let index = 0; index < frame.length; index++) {
        const absolute = Math.abs(frame[index]);
        if (absolute > frameMaxValue) frameMaxValue = absolute;
      }
      if (autoScaleOn) {
        const alpha = 0.15;
        const previousMax = smoothedMaxValueReference.current;
        const newMax = Math.max(frameMaxValue, previousMax * 0.95);
        smoothedMaxValueReference.current = previousMax * (1 - alpha) + newMax * alpha;
        pixelsPerUnit = (fullScale * vGain) / smoothedMaxValueReference.current;
      } else {
        pixelsPerUnit = fullScale * vGain;
      }

      // ---- Trigger markers (WebGL overlay + glyphs) ---------------------
      if (trigOn) {
        const clampedLevel = Math.max(-1, Math.min(1, trigLevel));
        const centerY = cssHeight / 2;
        const levelY = centerY - clampedLevel * fullScale;
        const active = draggingReference.current;
        const mk: [number, number, number, number] = active
          ? [0.976, 0.451, 0.086, 1]
          : [0.976, 0.451, 0.086, 0.75];
        const mkDim: [number, number, number, number] = [0.976, 0.451, 0.086, 0.35];

        // Dashed horizontal level line (right-edge handle reserves 46px).
        bundle.overlay.drawLine(
          toPhys(0), toPhys(levelY), toPhys(cssWidth - 46), toPhys(levelY),
          mk, active ? 2 : 1, "x", 6 * dpr + 5 * dpr, 6 / 11,
        );
        // Dashed vertical trigger-point line.
        bundle.overlay.drawLine(
          toPhys(0), toPhys(0), toPhys(0), toPhys(cssHeight),
          mkDim, 1, "y", 3 * dpr + 5 * dpr, 3 / 8,
        );
        // Filled drag handle.
        const handleWidth = 44;
        const handleHeight = 16;
        const handleY = Math.max(0, Math.min(cssHeight - handleHeight, levelY - handleHeight / 2));
        bundle.overlay.drawRect(toPhys(cssWidth - handleWidth), toPhys(handleY), toPhys(handleWidth), toPhys(handleHeight), mk);
        // Level value text on the handle.
        bundle.glyph.drawText(
          clampedLevel.toFixed(2),
          cssWidth - handleWidth + 5,
          handleY + (handleHeight - 10) / 2,
          10 * dpr,
          [0.067, 0.094, 0.125, 1], // #111820
        );

        // Edge arrow chevron (rising/falling).
        const arrowX = 10;
        const arrow: Float32Array =
          trigEdge === "falling"
            ? new Float32Array([arrowX - 4, levelY - 6, arrowX, levelY + 6, arrowX + 4, levelY - 6])
            : new Float32Array([arrowX - 4, levelY + 6, arrowX, levelY - 6, arrowX + 4, levelY + 6]);
        // Scale arrow to physical px and flip Y (overlay works in pixel space with flipY).
        const arrowPhys = new Float32Array(arrow.length);
        for (let i = 0; i < arrow.length; i += 2) {
          arrowPhys[i] = toPhys(arrow[i]);
          arrowPhys[i + 1] = toPhys(arrow[i + 1]);
        }
        bundle.overlay.drawPolyline(arrowPhys, mk, 1.5 * dpr);
      }

      // ---- Waveform trace (WebGL line renderer) -------------------------
      if (frame.length > 1) {
        bundle.scope.draw({
          samples: frame,
          pixelsPerUnit: pixelsPerUnit * dpr,
          invert: invertOn,
          color: traceColor,
          glow: glowOn ? 1 : 0,
          lineWidth: 2 * dpr,
        });
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      bundle.scope.dispose();
      bundle.spectrum.dispose();
      bundle.spectrogram.dispose();
      bundle.glyph.dispose();
      bundle.overlay.dispose();
      glCtx.dispose();
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
      {triggerEnabled && scopeView !== "spectrum" && scopeView !== "spectrogram" && (
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

/**
 * Draw frequency-axis labels under the spectrum using the WebGL glyph renderer
 * (keeps the spectrum view 100% on the GPU path; the old Canvas2D used
 * fillText). Mirrors the old labels (0, 1/4, 1/2, 3/4, max of the displayed
 * range, formatted with a "k" suffix above 1 kHz).
 */
function drawSpectrumAxisLabels(
  glyph: GlyphRenderer,
  spectrum: Spectrum,
  cssWidth: number,
  physH: number,
  dpr: number,
): void {
  const maxFrequency = Math.min(spectrum.sampleRate / 2, 20_000);
  const labelColor: [number, number, number, number] = [1, 1, 1, 0.5];
  for (let step = 0; step <= 4; step++) {
    const ratio = step / 4;
    const frequency = ratio * maxFrequency;
    const label =
      frequency >= 1000 ? `${(frequency / 1000).toFixed(1)}k` : `${Math.round(frequency)}`;
    const x = Math.min(cssWidth - 22, ratio * cssWidth + 2);
    const y = (physH / dpr) - 5 - 10; // 10px font, 5px margin from bottom
    glyph.drawText(label, x, y, 10 * dpr, labelColor);
  }
}
