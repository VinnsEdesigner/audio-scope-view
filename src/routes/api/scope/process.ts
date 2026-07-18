import { createFileRoute } from "@tanstack/react-router";
import {
  calibratedReadouts,
  decodeFloat32Body,
  frameOf,
  measure,
  parseCalibrationHeader,
  preprocess,
  type Edge,
} from "@/lib/scope/dsp.server";

export const Route = createFileRoute("/api/scope/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const sr = Math.max(8000, Number(url.searchParams.get("sr")) || 48000);
        const windowLen = Math.max(
          32,
          Math.min(8192, Number(url.searchParams.get("window")) || 1024),
        );
        const level = Number(url.searchParams.get("level")) || 0;
        const edge = (url.searchParams.get("edge") as Edge) || "rising";
        const cal = parseCalibrationHeader(request.headers.get("x-scope-cal"));

        const buf = await request.arrayBuffer();
        const raw = decodeFloat32Body(buf);
        const data = preprocess(raw, cal, sr);

        const frame = frameOf(data, windowLen, level, edge);
        const m = measure(data, sr);
        const calibrated = calibratedReadouts(m, cal);

        return Response.json({ type: "frame", frame, measurements: m, calibrated });
      },
    },
  },
});