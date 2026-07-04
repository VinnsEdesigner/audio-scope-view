import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square, Activity, Radio, Gauge, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { loadScopeEngine, type ScopeEngine } from "@/lib/scope/engine";
import { cn } from "@/lib/utils";

type EdgeMode = "rising" | "falling" | "auto";
type ViewMode = "time" | "spectrum";

const WINDOW = 1024;
const BUFFER = 16384;

function cssVar(el: HTMLElement, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || "#7CFC00";
}

export function Oscilloscope() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ScopeEngine | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const rafRef = useRef<number>(0);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleRate, setSampleRate] = useState(48000);

  // Controls (kept in refs so the draw loop reads live values)
  const [timeDiv, setTimeDiv] = useState(256); // samples across full width
  const [voltDiv, setVoltDiv] = useState(1); // vertical gain
  const [triggerLevel, setTriggerLevel] = useState(0);
  const [edge, setEdge] = useState<EdgeMode>("rising");
  const [view, setView] = useState<ViewMode>("time");

  const ctl = useRef({ timeDiv, voltDiv, triggerLevel, edge, view });
  ctl.current = { timeDiv, voltDiv, triggerLevel, edge, view };

  const [meas, setMeas] = useState({ vpp: 0, rms: 0, freq: 0, dc: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    const cx = canvas.getContext("2d");
    if (!cx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const trace = cssVar(canvas, "--scope-trace");
    const grid = cssVar(canvas, "--scope-grid");
    const bg = cssVar(canvas, "--scope-bg");

    cx.fillStyle = bg;
    cx.fillRect(0, 0, w, h);

    // graticule
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

    const { view: v, timeDiv: td, voltDiv: vd, triggerLevel: tl, edge: eg } = ctl.current;

    cx.strokeStyle = trace;
    cx.lineWidth = 2;
    cx.shadowColor = trace;
    cx.shadowBlur = 8;
    cx.beginPath();

    if (v === "time") {
      const edgeCode = eg === "rising" ? 1 : eg === "falling" ? -1 : 0;
      const frame = engine.frame(WINDOW, tl, edgeCode) as Float32Array;
      const span = Math.max(16, Math.min(WINDOW, td));
      for (let i = 0; i < span; i++) {
        const s = frame[i] ?? 0;
        const x = (i / (span - 1)) * w;
        const y = h / 2 - s * vd * (h / 2);
        i === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
      }
      cx.stroke();

      // trigger level marker
      cx.shadowBlur = 0;
      cx.strokeStyle = cssVar(canvas, "--color-accent") || trace;
      cx.setLineDash([4, 4]);
      const ty = h / 2 - tl * vd * (h / 2);
      cx.beginPath();
      cx.moveTo(0, ty);
      cx.lineTo(w, ty);
      cx.stroke();
      cx.setLineDash([]);
    } else {
      const mag = engine.spectrum(2048) as Float32Array;
      const bins = mag.length;
      const shown = Math.floor(bins / 2);
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

    const m = engine.measure();
    setMeas({ vpp: m.peak_to_peak, rms: m.rms, freq: m.frequency, dc: m.dc_offset });
    m.free();

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

      const engine = await loadScopeEngine(BUFFER, audio.sampleRate);
      engineRef.current = engine;

      const src = audio.createMediaStreamSource(stream);
      const proc = audio.createScriptProcessor(2048, 1, 1);
      proc.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        engineRef.current?.push(input);
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

  useEffect(() => () => stop(), [stop]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="size-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold leading-tight">ADC Probe Scope</h1>
            <p className="text-xs text-muted-foreground">
              Phone mic / line-in · {sampleRate.toLocaleString()} Hz · Rust DSP + WASM
            </p>
          </div>
        </div>
        <Button
          variant={running ? "destructive" : "default"}
          size="sm"
          onClick={running ? stop : start}
        >
          {running ? <Square className="size-4" /> : <Play className="size-4" />}
          {running ? "Stop" : "Probe"}
        </Button>
      </div>

      <div className="relative overflow-hidden rounded-lg border bg-scope-bg">
        <canvas ref={canvasRef} className="block h-64 w-full sm:h-80" />
        {!running && (
          <div className="absolute inset-0 flex items-center justify-center bg-scope-bg/70 text-center">
            <p className="max-w-xs px-6 text-sm text-muted-foreground">
              {error ?? "Tap Probe and allow microphone access to capture a live signal from the ADC / mic line."}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Stat icon={<Waves className="size-3.5" />} label="Vpp" value={meas.vpp.toFixed(3)} />
        <Stat icon={<Activity className="size-3.5" />} label="RMS" value={meas.rms.toFixed(3)} />
        <Stat icon={<Gauge className="size-3.5" />} label="Freq" value={`${meas.freq.toFixed(1)} Hz`} />
        <Stat icon={<Radio className="size-3.5" />} label="DC" value={meas.dc.toFixed(3)} />
      </div>

      <div className="flex gap-2">
        {(["time", "spectrum"] as ViewMode[]).map((m) => (
          <Button
            key={m}
            variant={view === m ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 capitalize"
            onClick={() => setView(m)}
          >
            {m}
          </Button>
        ))}
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-4">
        <Control label="Timebase" value={`${timeDiv} smp/div`}>
          <Slider min={32} max={WINDOW} step={16} value={[timeDiv]} onValueChange={([v]) => setTimeDiv(v)} />
        </Control>
        <Control label="Vertical gain" value={`${voltDiv.toFixed(1)}x`}>
          <Slider min={0.2} max={10} step={0.1} value={[voltDiv]} onValueChange={([v]) => setVoltDiv(v)} />
        </Control>
        <Control label="Trigger level" value={triggerLevel.toFixed(2)}>
          <Slider min={-1} max={1} step={0.01} value={[triggerLevel]} onValueChange={([v]) => setTriggerLevel(v)} />
        </Control>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Trigger edge</p>
          <div className="flex gap-2">
            {(["rising", "falling", "auto"] as EdgeMode[]).map((e) => (
              <Button
                key={e}
                variant={edge === e ? "secondary" : "ghost"}
                size="sm"
                className={cn("flex-1 capitalize")}
                onClick={() => setEdge(e)}
              >
                {e}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-2 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm text-primary">{value}</div>
    </div>
  );
}

function Control({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
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