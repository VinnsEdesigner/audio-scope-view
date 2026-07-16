import axios, { type AxiosInstance } from "axios";

/**
 * REST base for the Rust `scope-server`. Configure with `VITE_SCOPE_API_URL`.
 * All non-streaming calls (config, calibration, one-off measurements) go
 * through this axios instance — never the raw fetch API.
 */
export const SCOPE_API_URL =
  (import.meta.env.VITE_SCOPE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8787";

export const SCOPE_WS_URL =
  (import.meta.env.VITE_SCOPE_WS_URL as string | undefined) ??
  SCOPE_API_URL.replace(/^http/, "ws") + "/stream";

export const api: AxiosInstance = axios.create({
  baseURL: SCOPE_API_URL,
  timeout: 8000,
  headers: { "Content-Type": "application/json" },
});

*** Add File: src/lib/api/scope.ts
import { api } from "./client";

export type Calibration = {
  gain_v_per_unit: number;
  time_factor: number;
  lowpass_hz: number | null;
  smoothing: number;
};

export type Harmonic = { n: number; frequency: number; magnitude: number; db: number };

export type Measurements = {
  rms: number;
  peak_to_peak: number;
  min: number;
  max: number;
  mean: number;
  dc_offset: number;
  crest_factor: number;
  frequency: number;
  frequency_ac: number;
  period_ms: number;
  duty_cycle: number;
  thd: number;
  harmonics: Harmonic[];
  sample_rate: number;
  samples_available: number;
};

export type CalibratedReadouts = {
  vpp_v: number;
  rms_v: number;
  dc_v: number;
  frequency_hz: number;
};

export type Health = { status: string; version: string };

export const scopeApi = {
  health: () => api.get<Health>("/health").then((r) => r.data),
  getConfig: () =>
    api
      .get<{ sample_rate: number; calibration: Calibration }>("/config")
      .then((r) => r.data),
  getCalibration: () => api.get<Calibration>("/calibration").then((r) => r.data),
  setCalibration: (cal: Calibration) =>
    api.post<Calibration>("/calibration", cal).then((r) => r.data),
  measurements: () =>
    api
      .get<Measurements & { calibrated: CalibratedReadouts }>("/measurements")
      .then((r) => r.data),
  spectrum: (size = 2048) =>
    api.get<number[]>("/spectrum", { params: { size } }).then((r) => r.data),
};

*** Add File: src/lib/api/stream.ts
import { SCOPE_WS_URL } from "./client";
import type { Measurements, CalibratedReadouts } from "./scope";

export type StreamFrame = {
  type: "frame";
  frame: { samples: number[]; triggered: boolean; trigger_index: number };
  measurements: Measurements;
  calibrated: CalibratedReadouts;
};

export type StreamConfig = {
  window?: number;
  trigger_level?: number;
  edge?: "rising" | "falling" | "auto";
  sample_rate?: number;
};

export type StreamHandlers = {
  onFrame: (f: StreamFrame) => void;
  onOpen?: () => void;
  onError?: (e: Event) => void;
  onClose?: () => void;
};

/**
 * Opens a WebSocket to the Rust `scope-server`, ships raw Float32 sample
 * blocks as binary frames, and pipes JSON frames back to the caller.
 *
 * The server does all processing (trigger, FFT, THD, autocorrelation…).
 * The client is a dumb pipe + renderer.
 */
export function openScopeStream(
  hello: {
    sample_rate: number;
    window: number;
    trigger_level: number;
    edge: "rising" | "falling" | "auto";
  },
  handlers: StreamHandlers,
) {
  const ws = new WebSocket(SCOPE_WS_URL);
  ws.binaryType = "arraybuffer";
  let opened = false;

  ws.addEventListener("open", () => {
    opened = true;
    ws.send(JSON.stringify(hello));
    handlers.onOpen?.();
  });
  ws.addEventListener("message", (ev) => {
    if (typeof ev.data !== "string") return;
    try {
      const msg = JSON.parse(ev.data) as StreamFrame;
      if (msg.type === "frame") handlers.onFrame(msg);
    } catch {
      /* ignore malformed */
    }
  });
  ws.addEventListener("error", (e) => handlers.onError?.(e));
  ws.addEventListener("close", () => handlers.onClose?.());

  return {
    pushSamples(samples: Float32Array) {
      if (ws.readyState === WebSocket.OPEN) ws.send(samples.buffer);
    },
    sendConfig(cfg: StreamConfig) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "config", ...cfg }));
      }
    },
    close() {
      if (opened) ws.close();
      else ws.addEventListener("open", () => ws.close());
    },
    get readyState() {
      return ws.readyState;
    },
  };
}
