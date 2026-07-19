import axios from "axios";
import { SCOPE_API_BASE } from "./client";
import type { Calibration, Measurements, CalibratedReadouts } from "./scope";

export type StreamFrame = {
  type: "frame";
  frame: { samples: number[]; triggered: boolean; trigger_index: number };
  measurements: Measurements;
  calibrated: CalibratedReadouts;
};

export type StreamConfig = {
  window: number;
  trigger_level: number;
  edge: "rising" | "falling" | "auto";
  sample_rate: number;
};

export type StreamHandlers = {
  onFrame: (f: StreamFrame) => void;
  onOpen?: () => void;
  onError?: (e: unknown) => void;
  onClose?: () => void;
};

// The canvas trace is drawn client-side from raw mic samples, so the
// server round-trip only backs the numeric readouts (Vpp/RMS/Freq).
// Keep the window short and the rate low to avoid saturating the link
// on mobile networks.
const RING_SECONDS = 0.08; // ~80 ms window per request
const TARGET_FPS = 12;

/**
 * Same-origin scope stream. The client keeps a rolling ring buffer of the
 * most recent samples and, at ~30 Hz, POSTs it to `/api/scope/process`
 * where the TypeScript DSP engine (server-side, Cloudflare Workers) runs
 * trigger / measurement / spectrum and returns JSON. No WebSocket, no
 * external server — the browser talks to the built-in app server.
 */
export function openScopeStream(
  hello: StreamConfig,
  handlers: StreamHandlers,
  getCalibration: () => Calibration,
) {
  let cfg: StreamConfig = { ...hello };
  const ringSize = Math.max(2048, Math.round(cfg.sample_rate * RING_SECONDS));
  let ring = new Float32Array(ringSize);
  let writeIdx = 0;
  let filled = 0;
  let closed = false;
  let inFlight = false;

  handlers.onOpen?.();

  const linear = (): Float32Array => {
    if (filled < ring.length) return ring.subarray(0, filled);
    const out = new Float32Array(ring.length);
    out.set(ring.subarray(writeIdx));
    out.set(ring.subarray(0, writeIdx), ring.length - writeIdx);
    return out;
  };

  const tick = async () => {
    if (closed || inFlight || filled < cfg.window) return;
    inFlight = true;
    try {
      const samples = linear();
      const buf = new ArrayBuffer(samples.byteLength);
      new Float32Array(buf).set(samples);
      const cal = getCalibration();
      const res = await axios.post<StreamFrame>(
        `${SCOPE_API_BASE}/process`,
        buf,
        {
          params: {
            sr: cfg.sample_rate,
            window: cfg.window,
            level: cfg.trigger_level,
            edge: cfg.edge,
          },
          headers: {
            "Content-Type": "application/octet-stream",
            "x-scope-cal": JSON.stringify(cal),
          },
          responseType: "json",
          timeout: 4000,
        },
      );
      if (!closed && res.data?.type === "frame") handlers.onFrame(res.data);
    } catch (e) {
      handlers.onError?.(e);
    } finally {
      inFlight = false;
    }
  };

  const timer = window.setInterval(tick, Math.floor(1000 / TARGET_FPS));

  return {
    pushSamples(samples: Float32Array) {
      const cap = ring.length;
      for (let i = 0; i < samples.length; i++) {
        ring[writeIdx] = samples[i];
        writeIdx = (writeIdx + 1) % cap;
        if (filled < cap) filled++;
      }
    },
    sendConfig(patch: Partial<StreamConfig>) {
      cfg = { ...cfg, ...patch };
    },
    async spectrum(size = 2048): Promise<number[]> {
      if (filled < 64) return [];
      const samples = linear();
      const buf = new ArrayBuffer(samples.byteLength);
      new Float32Array(buf).set(samples);
      const res = await axios.post<number[]>(
        `${SCOPE_API_BASE}/spectrum`,
        buf,
        {
          params: { sr: cfg.sample_rate, size },
          headers: {
            "Content-Type": "application/octet-stream",
            "x-scope-cal": JSON.stringify(getCalibration()),
          },
          responseType: "json",
          timeout: 4000,
        },
      );
      return res.data ?? [];
    },
    close() {
      closed = true;
      window.clearInterval(timer);
      handlers.onClose?.();
    },
  };
}