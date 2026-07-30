# Audio Scope View

A web-based oscilloscope that captures audio and displays waveforms and frequency spectrums in real-time. Save sessions, play back recordings, export data.

## The project

- **vyzorWeb** — React frontend for the oscilloscope UI (canvas-based waveform rendering, live and , playback)
- **api-client** — TypeScript package with GraphQL queries/mutations and WebSocket handling
- **Rust server** — Handles GraphQL API, audio capture, DSP (FFT), and SQLite storage

The Rust server can run with mock audio (for testing without hardware) or real audio capture via cpal (ALSA/PulseAudio on Linux).

## Quick start

### Prerequisites

- Node.js 18+
- Rust 1.97+
- pnpm (`npm i -g pnpm`)


```

### Build

```bash
pnpm build
```

### Run the server

```bash
cd rust
export BOOTSTRAP_KEY=""
cargo run --release
```

Server starts on `http://127.0.0.1:8080` with:
- GraphQL API at `/graphql`
- WebSocket subscriptions for real-time audio
- Health check at `/graphql/health`

### Run the frontend

```bash
node simple-server.cjs
```

Serves the web app at `http://localhost:3003`, proxies GraphQL to the Rust server.

For development with hot reload:

```bash
cd apps/vyzorWeb
pnpm dev
```

## Project layout

```
audio-scope-view/
├── apps/
│   └── vyzorWeb/              # React app
│       └── src/
│           ├── components/     # UI components (scope, dialogs, layout)
│           ├── hooks/          # Audio, sessions, recordings, export
│           ├── routes/         # Pages (home, oscilloscope, settings)
│           └── store/          # Zustand stores
├── packages/
│   └── api-client/            # GraphQL client
│       └── src/
│           ├── audioScopeView/ # Generated GraphQL types
│           └── domain/         # Session, recording, waveform types
├── rust/
│   └── src/
│       ├── api/              # GraphQL schema + resolvers
│       ├── application/      # Business logic services
│       ├── domain/           # Entities, FFT, measurements, triggers
│       ├── infrastructure/   # SQLite repos, audio capture impls
│       └── shared/           # Config, errors, constants
├── mocks/                    # UI mockups and mock server
└── scripts/                  # Build and utility scripts
```

## Config

`rust/config.toml`:

```toml
[server]
host = "127.0.0.1"
port = 8080

[database]
url = "sqlite:./data/audio_scope_view.db?mode=rwc"

[audio]
backend = "mock"  # "mock", "alsa", or "pulse"

[security]
require_auth = true
bootstrap_key = "your-secure-key"
```

Environment variable `BOOTSTRAP_KEY`" ".

## Key concepts

**Sessions** are live capture sessions tied to an audio device. **Recordings** are saved waveform chunks you can play back later.

The web app has a **test mode** toggle that uses a mock audio generator instead of your microphone — handy when no mic is around.

## Stuff that doesn't work yet

- Mobile app (vyzorMobile) is incomplete
- Phone browsers apply processing to mic audio (AGC, noise cancellation) which ruins accuracy — use a USB audio interface if you need real measurements

## Common commands

```bash
pnpm build        # Build everything
pnpm dev          # Dev server for web app

```
