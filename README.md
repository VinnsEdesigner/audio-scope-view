# Audio Scope View

A browser-based audio oscilloscope and spectrum analyzer. Capture audio from your microphone, visualize waveforms and frequency spectrums in real-time, and save recordings for later playback.

## What it does

- **Live scope view** — Shows audio waveforms as they come in from your microphone
- **Spectrum analyzer** — FFT-based frequency display 
- **Recording** — Save audio sessions to the database and play them back later
- **Export** — Export waveform data and scope screenshots

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, TailwindCSS, TanStack Router |
| State | Zustand |
| Backend | Rust (Axum, GraphQL Yoga, SQLite) |
| Audio | Web Audio API (browser mic capture) |

## Project structure

```
audio-scope-view/
├── apps/
│   ├── vyzorWeb/          # Main web app
│   └── vyzorMobile/       # Mobile app (not actively developed)
├── packages/
│   ├── api-client/        # GraphQL client for the Rust server
│   └── ui/                # Shared UI components
├── rust/                  # Rust server (GraphQL + WebSocket)
│   ├── src/api/          # GraphQL schema, WebSocket handlers
│   ├── src/application/  # Business logic services
│   └── src/domain/       # Domain models and types
├── mocks/                # Mock data and UI prototypes
└── docs/                 # Architecture docs
```

## Quick start

### Prerequisites

- Node.js 18+
- Rust 1.75+
- pnpm (`npm i -g pnpm`)

### Install dependencies

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export COREPACK_ENABLE_AUTOINSTALL=0
export PNPM_TELEMETRY=0
pnpm install
```

### Build

```bash
pnpm build
```

### Run the server

```bash
cd rust
export BOOTSTRAP_KEY="your-16-char-key-here"
cargo run --release
```

The Rust server starts on `http://127.0.0.1:8080` and provides:
- GraphQL endpoint at `/graphql`
- WebSocket subscriptions for real-time audio streaming
- Health check at `/health`

### Run the frontend

```bash
node simple-server.cjs
```

This serves the built web app on `http://localhost:3003` and proxies GraphQL requests to the Rust server.

Or for development with hot reload:

```bash
cd apps/vyzorWeb
pnpm dev
```

## Configuration

### Rust server (`rust/config.toml`)

```toml
[server]
host = "127.0.0.1"
port = 8080

[database]
url = "sqlite:./data/audio_scope_view.db?mode=rwc"

[audio]
backend = "mock"  # Options: "mock", "alsa", "pulse"

[security]
require_auth = true
bootstrap_key = "your-secure-key"
```

### Environment variables

- `BOOTSTRAP_KEY` — Required for server startup. Must be at least 16 characters.

## Key concepts

### Sessions vs Recordings

A **session** is a live capture session tied to an audio device. A **recording** is a saved chunk of waveform data that can be played back independently.

### Test mode

The web app has a "test mode" toggle that switches from real microphone input to a mock audio generator. Useful when you don't have a mic connected or want consistent demo data.

### GraphQL API

The Rust server exposes a GraphQL API for:
- Creating/managing sessions
- Saving and loading recordings
- Querying waveform data
- API key authentication

## Known quirks

- Phone browser audio capture has processing applied (AGC, noise cancellation) that affects accuracy. Use a USB audio interface for real measurements.
- The C++ DSP layer mentioned in the architecture docs hasn't been implemented yet — DSP currently runs in the Rust server.
- The mobile app is a work in progress.

## Scripts

```bash
pnpm build          # Build all packages
pnpm dev           # Run web app in dev mode
pnpm lint          # Lint all packages
pnpm lint --fix    # Auto-fix lint issues
```

## License

Private project.
