# scope-server

Standalone Rust REST + WebSocket backend for the ADC Probe Scope. All DSP
(trigger, FFT, harmonics, THD, autocorrelation frequency, IIR low-pass,
boxcar smoothing) runs here — the browser only captures audio and draws.

## Run

```
cd rust-server
cargo run --release
```

Listens on `http://0.0.0.0:8787` by default. Override with `SCOPE_BIND=127.0.0.1:9000`.

## Endpoints

| Method | Path             | Notes                                                |
|--------|------------------|------------------------------------------------------|
| GET    | `/health`        | Liveness probe.                                      |
| GET    | `/config`        | Sample rate + current calibration.                   |
| GET    | `/calibration`   | Read calibration.                                    |
| POST   | `/calibration`   | JSON `{gain_v_per_unit,time_factor,lowpass_hz,smoothing}`. |
| GET    | `/measurements`  | Full measurement block (Vpp, RMS, THD, harmonics…). |
| GET    | `/spectrum?size=2048` | FFT magnitude bins.                             |
| GET    | `/frame?window=1024&level=0&edge=rising` | Triggered frame + measurements. |
| WS     | `/stream`        | Binary Float32Array samples in, JSON frames out.     |

## WebSocket protocol

1. Client sends a JSON hello: `{"sample_rate":48000,"window":1024,"trigger_level":0,"edge":"rising"}`.
2. Client sends binary blobs of little-endian `f32` samples (`Float32Array.buffer`).
3. Client may send `{"type":"config","edge":"falling"}` etc. at any time.
4. Server broadcasts JSON `{"type":"frame","frame":{samples,triggered,trigger_index},"measurements":{…},"calibrated":{…}}` at ~30 Hz.

## Client wiring

The React client reads `VITE_SCOPE_API_URL` (default `http://localhost:8787`)
and `VITE_SCOPE_WS_URL` (default `ws://localhost:8787/stream`). REST calls
use axios; sample streaming uses the browser WebSocket.