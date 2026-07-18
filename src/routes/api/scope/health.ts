import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/scope/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ status: "ok", engine: "ts-dsp", version: "1.0.0" }),
    },
  },
});