
## Goal

Delete the standalone `rust-server/` process. Move all DSP into the app's built-in server (TanStack Start on Cloudflare Workers) so the phone browser can reach it at the same URL as the app — no localhost, no separate deploy.

## Architecture

```text
Phone browser                       Same-origin Lovable server (Workers)
─────────────                       ─────────────────────────────────────
mic → Float32 blocks                POST /api/scope/process   (binary in, JSON out)
     └─ axios ─────────────────►    ├─ decode Float32Array
                                    ├─ Rust→WASM ScopeEngine.push()
                                    ├─ .frame() + .measure() + .spectrum()
JSON frame ◄──────────────────      └─ Response.json({ samples, measurements })
canvas draws
```

- Transport: `axios.post` with `Content-Type: application/octet-stream`, `responseType: 'json'`. No WebSocket — Workers don't do bidirectional WS cleanly, and short HTTP round-trips are fine at 20–30 fps for a scope UI.
- Session: server keeps a per-tab `sessionId` (uuid) in memory to hold the `ScopeEngine` ring buffer between requests. Config (`sample_rate`, `trigger_level`, `edge`, calibration) is sent on `POST /api/scope/config`.

## Files

**Add**
- `src/routes/api/scope/config.ts` — server route: create/update session, store calibration.
- `src/routes/api/scope/process.ts` — server route: accepts raw Float32 body, returns `{ samples, triggered, measurements, calibrated }`.
- `src/routes/api/scope/spectrum.ts` — server route: returns FFT bins on demand.
- `src/lib/scope/wasm-loader.server.ts` — loads `rust/scope-dsp` WASM once per Worker isolate (`import wasm from '../../wasm/scope-dsp/scope_dsp_bg.wasm?url'` + wasm-bindgen `initSync`).
- `src/lib/scope/session-store.server.ts` — `Map<sessionId, ScopeEngine>` with LRU eviction (bounded, 30 min idle).

**Change**
- `src/lib/api/client.ts` — `SCOPE_API_URL` becomes `""` (same origin). Remove `SCOPE_WS_URL`.
- `src/lib/api/stream.ts` — replace WebSocket with `pushSamples(bytes)` that posts to `/api/scope/process` and calls `onFrame` with the JSON reply. Keep the same handler shape so `Oscilloscope.tsx` doesn't change much.
- `src/lib/api/scope.ts` — point axios calls at `/api/scope/*`.
- `src/components/scope/Oscilloscope.tsx` — no logic change; just pass `sessionId` through.

**Delete**
- `rust-server/` (whole crate — no longer needed).

## WASM in the Worker

Cloudflare Workers support WASM imports. Vite `?url` gives us a bundled URL; we fetch it and `initSync` once at first request per isolate. The existing `rust/scope-dsp` crate exposes exactly what we need (`ScopeEngine.push/frame/measure/spectrum`), so no Rust changes.

## Verify

1. `curl -X POST` a few Float32 samples to `/api/scope/config` then `/api/scope/process`, assert JSON shape.
2. Open the preview on the phone, hit Probe, confirm the trace runs live and `Vpp/Freq` readouts update.
3. Check the Network tab — 20–30 POSTs/sec to `/api/scope/process`, ~2 KB each.

## Fallback if WASM-in-Worker misbehaves

If loading Rust-compiled WASM inside the Worker isolate fails (bundling edge case), port the small DSP surface (ring buffer, trigger, RMS, autocorrelation, radix-2 FFT) to a `dsp.server.ts` in TypeScript — same routes, same API, same client. Delivered behavior is identical.
