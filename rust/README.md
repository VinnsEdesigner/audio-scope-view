# Audio Scope View - Rust Server

A high-performance Rust server for the Audio Scope View web application.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                             │
│    GraphQL (async-graphql) + Axum HTTP Server              │
├─────────────────────────────────────────────────────────────┤
│                    Application Layer                         │
│         Services (Scope, Settings, Dashboard)               │
├─────────────────────────────────────────────────────────────┤
│                       Domain Layer                           │
│   Entities, Traits, Value Objects, Domain Errors            │
├─────────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                       │
│  SQLite Repositories, Audio Capture (ALSA/PulseAudio/Mock) │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **GraphQL API** - Modern query language for data fetching
- **SQLite** - Lightweight, embedded database for persistence
- **Audio Capture** - Support for ALSA, PulseAudio, and mock capture
- **Real-time Streaming** - WebSocket support for live waveform data
- **Clean Architecture** - Domain-driven design with clear separation

## Prerequisites

- Rust 1.85+
- SQLite development libraries

## Installation

```bash
# Build the project
cargo build --release

# Run the server
cargo run
```

## Configuration

Edit `config.toml`:

```toml
[server]
host = "127.0.0.1"
port = 8080

[database]
url = "sqlite:./data/audio_scope_view.db?mode=rwc"

[audio]
backend = "mock"  # Options: mock, alsa, pulse
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/graphql` | POST | GraphQL API |
| `/graphql/playground` | GET | GraphQL Playground UI |
| `/health` | GET | Health check |

## Development

```bash
# Run tests
cargo test

# Run with debug logging
RUST_LOG=debug cargo run

# Format code
cargo fmt

# Lint code
cargo clippy
```

## Database Migrations

Migrations are automatically applied on startup. Manual migration files are in `migrations/`.

## License

MIT
