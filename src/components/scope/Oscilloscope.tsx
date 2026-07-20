import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Square,
  Radio,
  Snowflake,
  Menu,
  ChevronDown,
  SlidersHorizontal,
  Crosshair,
  Ruler,
  Info,
  Activity,
  Camera,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Calibration } from "@/lib/api/scope";
import { openScopeStream, type StreamFrame } from "@/lib/api/stream";

type EdgeMode = "rising" | "falling" | "auto";
type ViewMode = "time" | "spectrum";
type PageId = "display" | "trigger" | "measurements" | "calibration" | "capture" | "about";
type TraceColor = "teal" | "red" | "blue";

const TRACE_COLORS: Record<TraceColor, string> = {
  teal: "oklch(0.82 0.14 190)",
  red: "oklch(0.62 0.24 25)",
  blue: "oklch(0.55 0.24 265)",
};

const WINDOW = 1024;
const PUSH_BLOCK = 1024;
const CLIENT_RING = 16384; // rolling raw-sample buffer for instant drawing
const MEAS_UPDATE_MS = 250;
const DRAW_FPS = 30;
const NOISE_FLOOR = 0.018;
const TRIGGER_HYSTERESIS = 0.018;
const TRACE_SMOOTHING = 0.72;

type Config = {
  timeDiv: number; // samples across the full width
  voltDiv: number; // vertical display gain
  triggerLevel: number;
  edge: EdgeMode;
  view: ViewMode;
  gridOn: boolean;
  glow: boolean;
  traceColor: TraceColor;
  invert: boolean;
  autoScale: boolean;
  gainCal: number; // volts per unit amplitude (measurement scaling)
  timeCal: number; // time-base correction factor (~1.0)
};

const DEFAULTS: Config = {
  timeDiv: 1024,
  voltDiv: 0.65,
  triggerLevel: 0,
  edge: "rising",
  view: "time",
  gridOn: true,
  glow: false,
  traceColor: "teal",
  invert: false,
  autoScale: false,
  gainCal: 1,
  timeCal: 1,
};

function cssVar(el: HTMLElement, name: string, fallback: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

const NAV: { id: PageId; label: string; icon: typeof Radio }[] = [
  { id: "display", label: "Display", icon: SlidersHorizontal },
  { id: "trigger", label: "Trigger", icon: Crosshair },
  { id: "measurements", label: "Measurements", icon: Activity },
  { id: "calibration", label: "Calibration", icon: Ruler },
  { id: "capture", label: "Capture", icon: Camera },
  { id: "about", label: "About", icon: Info },
];

function writeLocalFrame(
  ring: Float32Array,
  writeIdx: number,
  filled: number,
  out: Float32Array,
  level: number,
  edge: EdgeMode,
): void {
  const cap = ring.length;
  const windowLen = out.length;
  out.fill(0);
  if (filled < windowLen) return;
  const readAt = (i: number) => ring[((i % cap) + cap) % cap];
  const newest = (writeIdx - 1 + cap) % cap;
  const oldest = filled < cap ? 0 : writeIdx;
  const searchLen = Math.min(filled, cap) - windowLen;
  let start = newest - windowLen + 1;

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < windowLen; i++) {
    const sample = readAt(start + i);
    if (sample < min) min = sample;
    if (sample > max) max = sample;
  }

  if (max - min < NOISE_FLOOR) return;

  if (edge !== "auto" && searchLen > 2) {
    // Search backwards from newest for the most recent trigger crossing.
    const pre = Math.floor(windowLen / 8);
    const scan = Math.min(searchLen, 4096);
    const upper = level + TRIGGER_HYSTERESIS;
    const lower = level - TRIGGER_HYSTERESIS;
    const firstCandidate = newest - (windowLen - pre);
    for (let k = 1; k < scan; k++) {
      const idx = (firstCandidate - k + cap) % cap;
      const a = ring[(idx - 1 + cap) % cap];
      const b = ring[idx];
      const crossed =
        edge === "rising" ? a <= lower && b >= upper : a >= upper && b <= lower;
      if (crossed) {
        start = idx - pre;
        break;
      }
      if (idx === oldest) break;
    }
  }
  for (let i = 0; i < windowLen; i++) out[i] = readAt(start + i);
}

export function Oscilloscope() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const rafRef = useRef<number>(0);
  const lastTraceRef = useRef<Float32Array | null>(null);
  const drawTraceRef = useRef<Float32Array>(new Float32Array(WINDOW));
  const smoothTraceRef = useRef<Float32Array>(new Float32Array(WINDOW));
  const lastDrawAtRef = useRef(0);
  const wsRef = useRef<ReturnType<typeof openScopeStream> | null>(null);
  const latestFrameRef = useRef<StreamFrame | null>(null);
  const latestMeasAtRef = useRef(0);
  const spectrumRef = useRef<number[]>([]);
  const ringRef = useRef<Float32Array>(new Float32Array(CLIENT_RING));
  const ringWriteRef = useRef(0);
  const ringFilledRef = useRef(0);

  const [running, setRunning] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleRate, setSampleRate] = useState(48000);
  const [connected, setConnected] = useState(false);

  const [config, setConfig] = useState<Config>(DEFAULTS);
  const cfg = useRef(config);
  cfg.current = config;
  const update = useCallback(
    (patch: Partial<Config>) => setConfig((c) => ({ ...c, ...patch })),
    [],
  );

  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;

  const [page, setPage] = useState<PageId>("display");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);

  const [meas, setMeas] = useState({ vpp: 0, rms: 0, freq: 0, dc: 0 });
  const measRef = useRef(meas);

  const draw = useCallback(() => {
    const now = performance.now();
    if (now - lastDrawAtRef.current < 1000 / DRAW_FPS) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }
    lastDrawAtRef.current = now;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!cx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const c0 = cfg.current;
    const trace = TRACE_COLORS[c0.traceColor] ?? cssVar(canvas, "--scope-trace", "#33e0d0");
    const grid = cssVar(canvas, "--scope-grid", "rgba(120,160,170,0.35)");
    const bg = cssVar(canvas, "--scope-bg", "#111820");
    const accent = cssVar(canvas, "--color-accent", "CanvasText");

    cx.fillStyle = bg;
    cx.fillRect(0, 0, w, h);

    const c = c0;

    if (c.gridOn) {
      cx.strokeStyle = grid;
      cx.lineWidth = 1;
      const cols = 10;
      const rows = 8;
      cx.beginPath();
      for (let i = 0; i <= cols; i++) {
        const x = (i / cols) * w;
        cx.moveTo(x, 0);
        cx.lineTo(x, h);
      }
      for (let i = 0; i <= rows; i++) {
        const y = (i / rows) * h;
        cx.moveTo(0, y);
        cx.lineTo(w, y);
      }
      cx.stroke();
    }

    cx.strokeStyle = trace;
    cx.lineWidth = 2;
    cx.shadowColor = c.glow ? trace : "transparent";
    cx.shadowBlur = c.glow ? 10 : 0;
    cx.beginPath();

    if (c.view === "time") {
      let frame: Float32Array;
      if (frozenRef.current && lastTraceRef.current) {
        frame = lastTraceRef.current;
      } else {
        const span = Math.max(16, Math.min(WINDOW, c.timeDiv));
        const rawFrame = drawTraceRef.current.length === span
          ? drawTraceRef.current
          : (drawTraceRef.current = new Float32Array(span));
        const smoothFrame = smoothTraceRef.current.length === span
          ? smoothTraceRef.current
          : (smoothTraceRef.current = new Float32Array(span));
        writeLocalFrame(
          ringRef.current,
          ringWriteRef.current,
          ringFilledRef.current,
          rawFrame,
          c.triggerLevel,
          c.edge,
        );
        for (let i = 0; i < span; i++) {
          smoothFrame[i] = smoothFrame[i] * TRACE_SMOOTHING + rawFrame[i] * (1 - TRACE_SMOOTHING);
        }
        frame = smoothFrame;
        lastTraceRef.current = smoothFrame;
      }
      const span = frame.length;
      const sign = c.invert ? -1 : 1;
      let peak = 1e-6;
      if (c.autoScale) {
        for (let i = 0; i < span; i++) {
          const a = Math.abs(frame[i] ?? 0);
          if (a > peak) peak = a;
        }
      }
      const scale = c.autoScale ? (0.9 / peak) : c.voltDiv;
      for (let i = 0; i < span; i++) {
        const s = frame[i] ?? 0;
        const x = (i / (span - 1)) * w;
        const y = h / 2 - sign * s * scale * (h / 2);
        i === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
      }
      cx.stroke();

      // trigger level marker
      cx.shadowBlur = 0;
      cx.strokeStyle = accent;
      cx.setLineDash([4, 4]);
      const ty = h / 2 - c.triggerLevel * c.voltDiv * (h / 2);
      cx.beginPath();
      cx.moveTo(0, ty);
      cx.lineTo(w, ty);
      cx.stroke();
      cx.setLineDash([]);
    } else {
      const mag = spectrumRef.current;
      const bins = mag.length;
      const shown = Math.floor(bins / 2);
      if (shown < 2) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      let max = 1e-6;
      for (let i = 0; i < shown; i++) max = Math.max(max, mag[i]);
      for (let i = 0; i < shown; i++) {
        const x = (i / (shown - 1)) * w;
        const db = 20 * Math.log10((mag[i] + 1e-9) / max);
        const norm = Math.max(0, 1 + db / 80);
        const y = h - norm * h;
        i === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
      }
      cx.stroke();
    }
    cx.shadowBlur = 0;

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    nodeRef.current?.disconnect();
    nodeRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close();
    ctxRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    latestFrameRef.current = null;
    lastTraceRef.current = null;
    smoothTraceRef.current = new Float32Array(WINDOW);
    lastDrawAtRef.current = 0;
    ringRef.current = new Float32Array(CLIENT_RING);
    ringWriteRef.current = 0;
    ringFilledRef.current = 0;
    setConnected(false);
    setFrozen(false);
    setRunning(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const audio: AudioContext = new AC();
      await audio.resume();
      ctxRef.current = audio;
      setSampleRate(audio.sampleRate);

      const c = cfg.current;
      const calRef = () => ({
        gain_v_per_unit: cfg.current.gainCal,
        time_factor: cfg.current.timeCal,
        lowpass_hz: null,
        smoothing: 0,
      });
      const ws = openScopeStream(
        {
          sample_rate: audio.sampleRate,
          window: WINDOW,
          trigger_level: c.triggerLevel,
          edge: c.edge,
        },
        {
          onFrame: (f) => {
            latestFrameRef.current = f;
            const now = performance.now();
            if (!frozenRef.current && now - latestMeasAtRef.current > MEAS_UPDATE_MS) {
              const cal = f.calibrated;
              latestMeasAtRef.current = now;
              const prev = measRef.current;
              const next = {
                vpp: prev.vpp * 0.75 + cal.vpp_v * 0.25,
                rms: prev.rms * 0.75 + cal.rms_v * 0.25,
                freq: cal.frequency_hz > 2 ? prev.freq * 0.82 + cal.frequency_hz * 0.18 : prev.freq * 0.9,
                dc: prev.dc * 0.75 + cal.dc_v * 0.25,
              };
              measRef.current = next;
              setMeas(next);
            }
          },
          onOpen: () => setConnected(true),
          onError: () => setConnected(false),
          onClose: () => setConnected(false),
        },
        calRef,
      );
      wsRef.current = ws;

      const src = audio.createMediaStreamSource(stream);
      const proc = audio.createScriptProcessor(PUSH_BLOCK, 1, 1);
      proc.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        // Local ring: powers the canvas trace instantly (no server round-trip).
        const ring = ringRef.current;
        const cap = ring.length;
        let w = ringWriteRef.current;
        let f = ringFilledRef.current;
        for (let i = 0; i < input.length; i++) {
          ring[w] = input[i];
          w = (w + 1) % cap;
          if (f < cap) f++;
        }
        ringWriteRef.current = w;
        ringFilledRef.current = f;
        // Server: measurements only, at reduced rate inside the stream.
        wsRef.current?.pushSamples(input);
      };
      src.connect(proc);
      proc.connect(audio.destination);
      nodeRef.current = proc;

      setRunning(true);
      rafRef.current = requestAnimationFrame(draw);
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied. Allow mic access to use the probe."
          : "Could not access the audio input line.",
      );
      stop();
    }
  }, [draw, stop]);

  // Push trigger/edge changes to the server so DSP stays in sync.
  useEffect(() => {
    wsRef.current?.sendConfig({
      trigger_level: config.triggerLevel,
      edge: config.edge,
    });
  }, [config.triggerLevel, config.edge]);

  // Poll spectrum via axios only when spectrum view is active.
  useEffect(() => {
    if (config.view !== "spectrum" || !running) return;
    let alive = true;
    const tick = async () => {
      try {
        const bins = (await wsRef.current?.spectrum(2048)) ?? [];
        if (alive) spectrumRef.current = bins;
      } catch {
        /* ignore */
      }
      if (alive) setTimeout(tick, 100);
    };
    tick();
    return () => {
      alive = false;
    };
  }, [config.view, running]);

  // Calibration ships on every /process request via the `x-scope-cal`
  // header (see openScopeStream). No separate REST push needed.

  useEffect(() => () => stop(), [stop]);

  const timePerWidth = useMemo(() => {
    const secs = (config.timeDiv / (sampleRate * config.timeCal)) || 0;
    if (secs >= 1) return `${secs.toFixed(2)} s`;
    if (secs >= 1e-3) return `${(secs * 1e3).toFixed(2)} ms`;
    return `${(secs * 1e6).toFixed(1)} µs`;
  }, [config.timeDiv, config.timeCal, sampleRate]);

  const configPanel = (
    <ConfigPanel
      page={page}
      setPage={setPage}
      config={config}
      update={update}
      reset={() => setConfig(DEFAULTS)}
      sampleRate={sampleRate}
      timePerWidth={timePerWidth}
      meas={meas}
      onSnapshot={() => {
        const cv = canvasRef.current;
        if (!cv) return;
        const url = cv.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `scope-${Date.now()}.png`;
        a.click();
      }}
      onExportCsv={() => {
        const frame = lastTraceRef.current;
        if (!frame || !frame.length) return;
        const dt = 1 / Math.max(1, sampleRate * config.timeCal);
        const rows = ["t_s,amplitude"];
        for (let i = 0; i < frame.length; i++) {
          rows.push(`${(i * dt).toFixed(9)},${frame[i].toFixed(6)}`);
        }
        const blob = new Blob([rows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `scope-${Date.now()}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }}
    />
  );

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r bg-sidebar lg:flex">
        {configPanel}
      </aside>

      {/* Main scope area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open settings">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                {configPanel}
              </SheetContent>
            </Sheet>
            <Radio className="size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-tight">ADC Probe Scope</h1>
              <p className="truncate text-[11px] text-muted-foreground">
                {sampleRate.toLocaleString()} Hz · {connected ? "DSP readouts" : "local trace"}
              </p>
            </div>
          </div>
          <div />
          <div className="flex items-center gap-1.5">
            <Button
              variant={frozen ? "secondary" : "ghost"}
              size="sm"
              disabled={!running}
              onClick={() => setFrozen((f) => !f)}
              className={cn(frozen && "text-primary")}
            >
              <Snowflake className="size-4" />
              <span className="hidden sm:inline">{frozen ? "Hold" : "Freeze"}</span>
            </Button>
            <Button
              variant={running ? "secondary" : "default"}
              size="sm"
              onClick={running ? stop : start}
              className={cn(
                running &&
                  "bg-neutral text-neutral-foreground hover:bg-neutral-strong",
              )}
            >
              {running ? <Square className="size-4" /> : <Play className="size-4" />}
              {running ? "Stop" : "Probe"}
            </Button>
          </div>
        </header>

        {/* Canvas — near full screen */}
        <div className="relative min-h-0 flex-1 bg-scope-bg">
          <canvas ref={canvasRef} className="block h-full w-full" />
          {frozen && (
            <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
              HOLD
            </span>
          )}
          {!running && (
            <div className="absolute inset-0 flex items-center justify-center bg-scope-bg/70 text-center">
              <p className="max-w-xs px-6 text-sm text-muted-foreground">
                {error ??
                  "Tap Probe and allow microphone access to capture a live signal from the ADC / mic line."}
              </p>
            </div>
          )}
        </div>

        {/* Collapsible essential controls */}
        <Collapsible open={controlsOpen} onOpenChange={setControlsOpen} className="border-t bg-card">
          <div className="flex items-center justify-between px-3 py-1.5">
            <div className="flex items-center gap-3 overflow-x-auto text-[11px] text-muted-foreground">
              <Readout label="Vpp" value={meas.vpp.toFixed(3)} />
              <Readout label="Freq" value={`${meas.freq.toFixed(1)} Hz`} />
              <Readout label="Win" value={timePerWidth} />
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Controls
                <ChevronDown
                  className={cn("size-4 transition-transform", controlsOpen && "rotate-180")}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="space-y-3 px-3 pb-3">
              <div className="flex gap-2">
                {(["time", "spectrum"] as ViewMode[]).map((m) => (
                  <Button
                    key={m}
                    variant={config.view === m ? "secondary" : "ghost"}
                    size="sm"
                    className="flex-1 capitalize"
                    onClick={() => update({ view: m })}
                  >
                    {m}
                  </Button>
                ))}
              </div>
              <Control label="Timebase" value={`${config.timeDiv} smp`}>
                <Slider
                  min={32}
                  max={WINDOW}
                  step={16}
                  value={[config.timeDiv]}
                  onValueChange={([v]) => update({ timeDiv: v })}
                />
              </Control>
              <Control label="Vertical gain" value={`${config.voltDiv.toFixed(1)}x`}>
                <Slider
                  min={0.2}
                  max={10}
                  step={0.1}
                  value={[config.voltDiv]}
                  onValueChange={([v]) => update({ voltDiv: v })}
                />
              </Control>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

function ConfigPanel({
  page,
  setPage,
  config,
  update,
  reset,
  sampleRate,
  timePerWidth,
}: {
  page: PageId;
  setPage: (p: PageId) => void;
  config: Config;
  update: (patch: Partial<Config>) => void;
  reset: () => void;
  sampleRate: number;
  timePerWidth: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Radio className="size-5 text-primary" />
        <div>
          <p className="text-sm font-semibold leading-tight">Configuration</p>
          <p className="text-[11px] text-muted-foreground">Probe setup pages</p>
        </div>
      </div>

      <nav className="grid grid-cols-2 gap-1 p-2 lg:grid-cols-1">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setPage(n.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
              page === n.id
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent",
            )}
          >
            <n.icon className="size-4 shrink-0" />
            {n.label}
          </button>
        ))}
      </nav>

      <ScrollArea className="min-h-0 flex-1 border-t">
        <div className="space-y-4 p-4">
          {page === "display" && (
            <>
              <Control label="Timebase" value={`${config.timeDiv} smp`}>
                <Slider
                  min={32}
                  max={WINDOW}
                  step={16}
                  value={[config.timeDiv]}
                  onValueChange={([v]) => update({ timeDiv: v })}
                />
              </Control>
              <Control label="Vertical gain" value={`${config.voltDiv.toFixed(1)}x`}>
                <Slider
                  min={0.2}
                  max={10}
                  step={0.1}
                  value={[config.voltDiv]}
                  onValueChange={([v]) => update({ voltDiv: v })}
                />
              </Control>
              <ToggleRow
                label="Graticule grid"
                checked={config.gridOn}
                onChange={(v) => update({ gridOn: v })}
              />
              <ToggleRow
                label="Trace glow"
                checked={config.glow}
                onChange={(v) => update({ glow: v })}
              />
            </>
          )}

          {page === "trigger" && (
            <>
              <Control label="Trigger level" value={config.triggerLevel.toFixed(2)}>
                <Slider
                  min={-1}
                  max={1}
                  step={0.01}
                  value={[config.triggerLevel]}
                  onValueChange={([v]) => update({ triggerLevel: v })}
                />
              </Control>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Trigger edge</p>
                <div className="flex gap-2">
                  {(["rising", "falling", "auto"] as EdgeMode[]).map((e) => (
                    <Button
                      key={e}
                      variant={config.edge === e ? "secondary" : "ghost"}
                      size="sm"
                      className="flex-1 capitalize"
                      onClick={() => update({ edge: e })}
                    >
                      {e}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {page === "calibration" && (
            <>
              <p className="text-xs text-muted-foreground">
                Map raw ADC readings to real-world units. Enter a known reference to scale
                measurements and correct the time base.
              </p>
              <NumField
                label="Gain — volts per unit"
                value={config.gainCal}
                step={0.01}
                min={0.001}
                onChange={(v) => update({ gainCal: v })}
                help="Multiplies Vpp / RMS / DC readouts."
              />
              <NumField
                label="Time-base factor"
                value={config.timeCal}
                step={0.001}
                min={0.5}
                max={2}
                onChange={(v) => update({ timeCal: v })}
                help="Fine-tune frequency & window timing (1.000 = uncorrected)."
              />
              <div className="rounded-md border bg-muted/40 p-3 text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Sample rate</span>
                  <span className="font-mono text-foreground">{sampleRate.toLocaleString()} Hz</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Window span</span>
                  <span className="font-mono text-foreground">{timePerWidth}</span>
                </div>
              </div>
              <Button variant="secondary" size="sm" className="w-full" onClick={reset}>
                Reset all to defaults
              </Button>
            </>
          )}

          {page === "about" && (
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">ADC Probe Scope</span> turns your
                phone's microphone / line-in into a real-time oscilloscope.
              </p>
              <p>Signal processing runs in a Rust engine compiled to WebAssembly.</p>
              <p>Rendering uses the HTML5 canvas with a bright teal trace.</p>
              <p>The interface follows your device's native light / dark theme automatically.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1 whitespace-nowrap">
      <span className="uppercase tracking-wide">{label}</span>
      <span className="font-mono text-primary">{value}</span>
    </span>
  );
}

function Control({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-mono text-primary">{value}</span>
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step,
  min,
  max,
  help,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  help?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        type="number"
        inputMode="decimal"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="font-mono"
      />
      {help && <p className="mt-1 text-[11px] text-muted-foreground">{help}</p>}
    </div>
  );
}
