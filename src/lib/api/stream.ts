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
      if (ws.readyState === WebSocket.OPEN) {
        // Copy into a fresh ArrayBuffer so we always send a plain
        // ArrayBuffer (not SharedArrayBuffer) and exactly the sample range.
        const buf = new ArrayBuffer(samples.byteLength);
        new Float32Array(buf).set(samples);
        ws.send(buf);
      }
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