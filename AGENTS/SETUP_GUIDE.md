# Setup Guide for Audio Scope View

> Complete environment setup for all four layers of the project: the **C++ DSP
> core** (`sdk/`), the **WebAssembly build** (`sdk/wasm/`), the **Rust server**
> (`rust/`), and the **web/mobile apps** (`apps/`, `packages/`).
>
> Verified against a clean Debian/Ubuntu container. Last updated 2026-08-11.

## Prerequisites (OS-level)

| Tool | Min version | Why |
|---|---|---|
| Node.js | 22+ | Web/mobile apps, dsp-wasm tests |
| pnpm | 11+ (via corepack) | Monorepo package manager |
| Git | any | Clone + version control |
| Python 3 | 3.10+ | CMake / GoogleTest fetch, build scripts |

Node + pnpm are managed via **corepack** (ships with Node). The pnpm prompts
that hang in CI/containers are disabled with three env vars (see Step 1).

---

## Step 1 — Node.js + pnpm (web/mobile/dsp-wasm)

Corepack manages pnpm. Disable its interactive prompts first, then install.

```bash
# Prevent pnpm/corepack from hanging on interactive prompts in CI/containers
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export COREPACK_ENABLE_AUTOINSTALL=0
export PNPM_TELEMETRY=0

# Enable corepack (ships with Node 22+)
corepack enable

# From the repo root
cd /workspace/project/audio-scope-view
pnpm install --frozen-lockfile   # uses pnpm-lock.yaml; reproducible
```

pnpm uses a **per-package** `node_modules` layout (not hoisted to root). So
`apps/vyzorWeb/node_modules/zustand`, `react`, `vite`, and the workspace
symlinks (`@audio-scope-view/dsp-wasm`, `@audio-scope-view/api-client`, …)
live under `apps/vyzorWeb/node_modules/`, not at the repo root. This is
expected — do not look for them in the root `node_modules/`.

---

## Step 2 — C++ build toolchain (native DSP core + tests)

Required to build `sdk/dsp` + `sdk/common` natively and run the GoogleTest
suite via `ctest`.

```bash
sudo apt-get update
sudo apt-get install -y \
  cmake \
  ninja-build \
  g++ \
  make \
  pkg-config \
  libasound2-dev \
  liblz4-dev
```

| Package | Purpose |
|---|---|
| `cmake` ≥ 3.21 | C++ build system (CMakePresets) |
| `ninja-build` | Fast C++ build backend (used by the presets) |
| `g++` ≥ 11 | C++17 compiler (GCC 14 verified) |
| `pkg-config` | Locate system libs (liblz4) for the native + Rust builds |
| `libasound2-dev` | ALSA audio binding (`sdk/bindings/linux/alsa_binding.cpp`) |
| `liblz4-dev` | LZ4 compression — system lib for the **Rust** build + native C++ (see LZ4 note below) |

### LZ4 — two paths

The C++ core uses LZ4 for waveform compression. There are two ways to supply it:

1. **System library** (default, used by the Rust server build + recommended for
   Linux): install `liblz4-dev` above. `rust/build.rs` finds it via
   `pkg-config liblz4`.
2. **Vendored sources** (used by WASM + Android, and available for native):
   the LZ4 C sources are vendored at `sdk/dsp/third_party/lz4/`. Enable them
   for the native build with:
   ```bash
   cmake --preset linux -D AUDIOSCOPE_USE_VENDORED_LZ4=ON
   ```
   Use this when you do not want a system `liblz4` dependency (e.g. a clean
   container that only runs `ctest`).

### Build + test the native C++ core

```bash
cd sdk
cmake --preset linux                       # configure (add -D AUDIOSCOPE_USE_VENDORED_LZ4=ON if no system liblz4)
cmake --build build/linux                  # build libaudioscope_dsp + tests
(cd build/linux && ctest --output-on-failure)   # 36 GoogleTest cases
```

Expected: `100% tests passed, 0 tests failed out of 36`.

---

## Step 3 — Emscripten SDK (WASM build → `packages/dsp-wasm`)

The C++ DSP core is compiled to WebAssembly so the web app has the **same**
DSP as native, with no duplicate TS FFT. `sdk/wasm/build.sh` produces
`packages/dsp-wasm/dist/audioscope.{js,wasm}`.

```bash
# One-time: clone + install + activate the Emscripten SDK
git clone --depth 1 https://github.com/emscripten-core/emsdk.git "$HOME/emsdk"
cd "$HOME/emsdk"
./emsdk install latest
./emsdk activate latest

# Persist for every shell (do once)
echo 'source "$HOME/emsdk/emsdk_env.sh"' >> "$HOME/.bashrc"

# Load it in the current shell
source "$HOME/emsdk/emsdk_env.sh"
emcc --version   # should print Emscripten 3.1.x+ (6.0.6 verified)
```

### Build the WASM artifact

```bash
cd /workspace/project/audio-scope-view
bash sdk/wasm/build.sh
# → packages/dsp-wasm/dist/audioscope.js (16K)
# → packages/dsp-wasm/dist/audioscope.wasm (42K)
```

The web `build` script runs `build:wasm` first, so this is automated in CI;
run it manually after a C++ core change to refresh the artifact.

### Test the WASM artifact (Node)

```bash
pnpm --filter @audio-scope-view/dsp-wasm test   # vitest, 12 cases — loads the .wasm in Node
```

---

## Step 4 — Rust toolchain (server: transport + storage + FFI to C++)

The Rust server is **transport + storage + auth only** — it does not implement
DSP. It links the same C++ core via the `cc` build-dependency in
`rust/build.rs` (compiles `sdk/common` + `sdk/dsp` + the FFI bridge into the
server binary at build time).

```bash
# One-time: install rustup + stable toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
  --default-toolchain stable --profile minimal
source "$HOME/.cargo/env"
echo '. "$HOME/.cargo/env"' >> "$HOME/.bashrc"

rustc --version   # ≥ 1.97 (matches rust-version in rust/Cargo.toml)
cargo  --version
```

### Rust native deps

The Rust build needs the system libs installed in Step 2:
- **`liblz4-dev`** — `rust/build.rs` links lz4 via `pkg-config liblz4`.
- **`libsqlite3-dev`** — sqlx (SQLite/Turso) links the system SQLite.
- **`libasound2-dev`** — cpal's ALSA backend.

```bash
sudo apt-get install -y libsqlite3-dev   # (liblz4-dev already installed in Step 2)
```

### Build + test the Rust server

```bash
cd rust
cargo build --release     # compiles the C++ core in via build.rs (no --features flag)
cargo test                # 31 tests — exercises the C++ core via FFI
```

The DSP is the C++ core reached through FFI; `cargo test` proves parity with
the native C++ + WASM bindings. No `--features` flag is needed — `cpal` is now
a non-optional dependency (the old `mock`/`pulse`/`real-audio` features were
removed).

### Run the Rust server (for local full-stack dev)

The web app's Vite dev server proxies `/graphql` to `127.0.0.1:8090` (see
`apps/vyzorWeb/vite.config.ts`), so for local development the Rust server
**must listen on port 8090**, not its default 8080. Override via the config
env prefix `APP__` (double-underscore separator, matching `.env.example`):

```bash
# From the repo root. Required env vars:
#   BOOTSTRAP_KEY  — server auth credential (≥ 16 chars; falls back to
#                    APP__SECURITY__BOOTSTRAP_KEY from the config file if unset)
#   APP__SERVER__PORT=8090  — match the Vite proxy target
#   APP__DATABASE__URL     — sqlite (local) or libsql://… (Turso)
#   TURSO_VYZOR_SCOPE_DB_TOKEN  — only when APP__DATABASE__URL is a libsql:// URL
export BOOTSTRAP_KEY="dev-bootstrap-key-change-in-production"
export APP__SERVER__HOST=127.0.0.1 APP__SERVER__PORT=8090
export APP__DATABASE__URL="sqlite:./data/audio_scope_view.db?mode=rwc"   # local
# export APP__DATABASE__URL="libsql://<your-db>.turso.io" TURSO_VYZOR_SCOPE_DB_TOKEN=<token>  # Turso

cd rust
cargo run --release          # → "Server listening on http://127.0.0.1:8090"
```

Health check: `curl http://127.0.0.1:8090/health` → `Yes am alive`.

For a quick smoke test, disable auth and create a session via the bootstrap
key (sent as a Bearer token):

```bash
curl -X POST http://127.0.0.1:8090/graphql \
  -H "Authorization: Bearer $BOOTSTRAP_KEY" -H "Content-Type: application/json" \
  -d '{"query":"mutation { createNamedSession(input:{name:\"smoke\"}){id} }"}'
```

---

## Step 5 — Run the web app + verify the full stack

The scope view uses a **WebGL2** renderer (Canvas2D was removed in Step 4 of
the architecture migration). Any modern browser (Chrome/Edge 113+, Firefox
113+, Safari 15+) provides WebGL2; no build dependency is added — it is a
runtime/usage requirement only.

The frontend reads the bootstrap key from `VITE_BOOTSTRAP_KEY` (embedded at
Vite dev-server start / build time, **not** read at runtime). Create a
`.env.local` so the web client can authenticate against the Rust backend:

```bash
# apps/vyzorWeb/.env.local  (gitignored — do not commit)
VITE_BOOTSTRAP_KEY=dev-bootstrap-key-change-in-production
```

Start the web dev server (the Rust backend from the previous section must
already be running on port 8090):

```bash
cd /workspace/project/audio-scope-view
pnpm dev          # Vite dev server on http://localhost:5173 (host 0.0.0.0)
```

The Vite middleware proxies `/graphql` → `127.0.0.1:8090`, so the web app
can create/view sessions. Open `http://localhost:5173/oscilloscope` and either
create a session or append `?sessionId=<id>` from the curl call above.

The scope page offers three WebGL2 views — **time / spectrum / spectrogram**
(the spectrogram view is new in Step 4) — and a **Waveform Generator** dialog
(Activity icon in the top bar) that replaces the old, non-functioning "test
mode". The generator feeds the scope from the C++ DSP core via WASM
(`dsp.generateWaveform`), so you can verify rendering without a live audio
input: open the dialog, pick a waveform (Sine/Square/Sawtooth/Triangle/Noise),
and the measurement panel shows the expected Vpp / Freq / Win.

---

## Step 6 — Verify everything is green

Run all four verification layers after setup:

```bash
# 1. Web app typecheck
npx tsc --noEmit -p apps/vyzorWeb/tsconfig.json

# 2. WASM DSP tests (Node)
pnpm --filter @audio-scope-view/dsp-wasm test        # 12/12

# 3. Native C++ SDK tests
(cd sdk/build/linux && ctest)                        # 36/36

# 4. Rust server tests (FFI parity with the C++ core)
(cd rust && cargo test)                              # 31/31
```

All four exercise the **same** C++ DSP core, so parity is provable across
native, WASM, and FFI.

---

## Day-to-day commands (root `package.json`)

```bash
pnpm dev          # web app dev server (vite, port 5173)
pnpm build        # build:wasm → vyzor-web build → sync-dist
pnpm build:wasm   # rebuild the WASM artifact only
pnpm build:sdk    # build the native C++ core (cmake preset linux)
pnpm test:sdk     # build + ctest the native C++ core
pnpm test:wasm    # dsp-wasm vitest
pnpm lint         # eslint across workspaces (turbo)
pnpm typecheck    # tsc across workspaces (turbo)
pnpm clean        # remove build/dist artifacts
```

---

## Troubleshooting

### `ECONNREFUSED 127.0.0.1:8090` in the browser console

The web dev server is running but the Rust backend is not (or is on the wrong
port). Start it on port 8090 as described in "Run the Rust server" above:
```bash
BOOTSTRAP_KEY=dev-bootstrap-key-change-in-production \
APP__SERVER__PORT=8090 APP__DATABASE__URL="sqlite:./data/audio_scope_view.db?mode=rwc" \
  cargo run --release --manifest-path rust/Cargo.toml
```

### `Unauthorized: Invalid or missing API key` on every GraphQL request

The Rust backend is up but the frontend has no bootstrap key. Create
`apps/vyzorWeb/.env.local` with `VITE_BOOTSTRAP_KEY=<same value as the
server's BOOTSTRAP_KEY>` and restart `pnpm dev` (Vite embeds env vars at
startup, so a restart is required).

### pnpm hangs / prompts in CI

Set before `pnpm install`:
```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export COREPACK_ENABLE_AUTOINSTALL=0
export PNPM_TELEMETRY=0
```

### `emcc: command not found`

The Emscripten env is not on PATH. Source it:
```bash
source "$HOME/emsdk/emsdk_env.sh"
```

### `fatal error: lz4.h: No such file or directory` (native C++ build)

No system `liblz4-dev`, and the build is not using the vendored copy. Either:
```bash
sudo apt-get install -y liblz4-dev
```
…or rebuild with the vendored LZ4:
```bash
cd sdk && rm -rf build/linux && cmake --preset linux -D AUDIOSCOPE_USE_VENDORED_LZ4=ON
```

### `cargo` link error: `-llz4` / `cannot find -lstdc++`

The Rust `build.rs` needs the C++ standard lib + liblz4. Ensure Step 2's
`g++` and `liblz4-dev` are installed; `cargo build` emits the
`-lstdc++` / `-llz4` link args itself.

### Web app typecheck fails on `@audio-scope-view/dsp-wasm` import

The WASM artifact is missing. Run `pnpm build:wasm` (or `bash sdk/wasm/build.sh`)
to stage `packages/dsp-wasm/dist/audioscope.{js,wasm}`. The hand-written
`dist/audioscope.d.ts` is committed so typecheck works in a fresh checkout,
but the `.js`/`.wasm` are gitignored and regenerated.

### Build errors after a C++ core change

Clean and rebuild the affected layer:
```bash
pnpm clean
pnpm install
pnpm build:wasm     # refresh the WASM artifact
(cd sdk && rm -rf build/linux && cmake --preset linux && cmake --build build/linux)
```

### Stale lockfile / supply-chain policy

`pnpm install --frozen-lockfile` refuses to mutate `pnpm-lock.yaml`. If the
lockfile is genuinely out of date, drop `--frozen-lockfile` once to update it,
then commit the result.
