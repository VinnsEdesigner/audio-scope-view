import { createFileRoute } from "@tanstack/react-router";
import {
  decodeFloat32Body,
  parseCalibrationHeader,
  preprocess,
  spectrumOf,
} from "@/lib/scope/dsp.server";

export const Route = createFileRoute("/api/scope/spectrum")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const sr = Math.max(8000, Number(url.searchParams.get("sr")) || 48000);
        const size = Math.max(
          64,
          Math.min(8192, Number(url.searchParams.get("size")) || 2048),
        );
        const cal = parseCalibrationHeader(request.headers.get("x-scope-cal"));
        const raw = decodeFloat32Body(await request.arrayBuffer());
        const data = preprocess(raw, cal, sr);
        return Response.json(spectrumOf(data, size));
      },
    },
  },
});