# audio-scope-view

## Frontend (web app) gotchas
- The home recordings list reads `useRecentRecordings` (query `GET_RECENT_RECORDINGS`), NOT `useRecordings` (`GET_RECORDINGS`). Any recording mutation (pin/rename/delete/create) must refetch `GET_RECENT_RECORDINGS` too, or the home list shows stale pin/rename/delete state. See `RECENT_RECORDINGS_REFETCH` in `apps/vyzorWeb/src/hooks/use-recordings.ts`.
- Main scroll container is `apps/vyzorWeb/src/root.tsx:55` (`overflow-y-auto`), which clips absolutely-positioned dropdowns that extend beyond it. `position: fixed` dialogs (session-settings, create-session) escape this, but their downward dropdowns can still run off the viewport on mobile — `InlineSelect` flips up / clamps `maxHeight` to available space to handle this.
- More-menu / popover z-index: use `z-50` (sticky header is `z-30`). The recordings more-menu previously used `z-10` and rendered behind later rows.
- GraphQL fragments/queries were verified to match the Rust schema via introspection (SESSION_FIELDS, RECORDING_FIELDS, RECORDING_SUMMARY_FIELDS, SessionWithStatusFields, all wrapper result types).

## Docker / Client-Server Connection (IMPORTANT)
- The deployed image bundles a static-server (Node, port 3000) that serves the SPA and reverse-proxies `/graphql` and `/ws` to the Rust backend (127.0.0.1:8080 inside the container). So the browser must use **relative** endpoints (`/graphql`, `/ws`), NOT absolute `ws://localhost:8080/...` URLs — the browser's `localhost` is not the container's localhost, so absolute URLs break in Docker/remote deploys.
- `packages/api-client/src/config.ts` `DEFAULT_CONFIG`: `graphqlEndpoint: "/graphql"`, `websocketEndpoint: "/ws"`. `apps/vyzorWeb/src/hooks/use-waveform-stream.ts` builds the WS URL from `location.host` + `/ws`. `.env.example` and `render.yaml` set `VITE_WEBSOCKET_ENDPOINT=/ws`.
- `VITE_*` env vars are baked into the frontend bundle at **build** time (Vite), not read at runtime. A deployed image with stale/empty build-time env will be broken regardless of runtime env — rebuild the image to pick up new values.
- **Image freshness matters:** the ghcr image must be rebuilt from current source after client-side changes. A stale image renders the UI but the Apollo client may silently fail to fire queries (no POST /graphql in server logs). Always rebuild + redeploy after frontend fixes.
- Run locally: `docker run -p 3000:3000 -p 8080:8080 -e BOOTSTRAP_KEY="$(openssl rand -hex 32)" ghcr.io/vinnsedesigner/audio-scope-view:latest`. Health: `curl http://localhost:3000/health`.
- Dev frontend (no Docker): `pnpm --filter @audio-scope-view/vyzor-web dev` (add a `server.proxy` in vite.config.ts pointing `/graphql`+`/ws` at the backend port to test against a running server).

## Build & Run
- Rust project in `rust/` directory; pinned toolchain `nightly-2026-07-20` (via `rust-toolchain.toml`)
- Build: `cd rust && cargo build --release` (release takes ~2m; only warnings)
- Run against Turso cloud:
  ```
  cd rust
  export APP__DATABASE__URL="$TURSO_DB_URL"          # libsql://vyzor-scopedb-vinnsedesigner.aws-us-west-2.turso.io
  export TURSO_VYZOR_SCOPE_DB_TOKEN="$TURSO_VYZOR_SCOPE_DB_TOKEN"  # DB-scoped token (read directly by server)
  export BOOTSTRAP_KEY="$(openssl rand -base64 32)"  # >=16 chars, required
  export APP__SERVER__HOST="0.0.0.0" APP__SERVER__PORT="8090"
  ./target/release/audio-scope-view
  ```
- Health check: `curl http://127.0.0.1:8090/health` -> "Yes am alive"
- GraphQL endpoint: `POST http://127.0.0.1:8090/graphql` with `Authorization: Bearer <bootstrap-key>`
- No-auth request returns 200 with GraphQL error "Unauthorized..." (auth enforced at GraphQL layer)

### Turso Token Distinction (IMPORTANT)
- `TURSO_AUTH_TOKEN` (secret) = **platform API token** → works for `turso` CLI (`TURSO_API_TOKEN=$TURSO_AUTH_TOKEN turso db list`), returns **401** against the DB HTTP API. NOT read by the server.
- `TURSO_VYZOR_SCOPE_DB_TOKEN` (secret) = **DB-scoped token** → returns **200** against the DB HTTP API. The server reads this env var directly in `database_connection.rs::new_turso()`.
- `TURSO_DB_URL` (secret) = `libsql://vyzor-scopedb-vinnsedesigner.aws-us-west-2.turso.io`
- Turso CLI binary: `~/.turso/turso` (add `$HOME/.turso` to PATH); installed via `curl -sSfL https://get.tur.so/install.sh | sh`

## Turso HTTP API Integration

### Architecture
- `infrastructure/turso_http_client.rs`: TursoClient uses Turso v2 pipeline API (`POST /v2/pipeline`)
- All repos (`repo_turso_*.rs`) use parameterized queries (`?` placeholders) for SQL injection safety
- `TursoArg` enum serializes bound parameters with `{"type":"text/integer/float/null","value":...}` tags

### Key Gotchas (Fixed)
1. **NaN/Infinity serialization**: serde_json serializes `f32::NEG_INFINITY`/`NaN` as `null`, which Turso rejects for NOT NULL columns. `TursoArg::float()` sanitizes non-finite values to 0.0.
2. **SELECT * column ordering**: `ALTER TABLE ADD COLUMN` appends columns to the end, breaking positional index assumptions in `row_to_*` mappers. Use explicit column lists (e.g. `RECORDING_COLUMNS` constant in recording repo, explicit SELECT in user_preferences repo) instead of `SELECT *`. Affected: recordings (sample_rate added by migration 008), user_preferences (auto_close_timeout_secs).
3. **Multi-statement SQL**: Turso v2 API rejects multi-statement SQL strings. `database_connection.rs` splits them before sending.
4. **TursoResult enum**: Match on `TursoResult::Ok(ok)` to extract results, `TursoResult::Error { error }` for errors.

### Turso DB
- Cloud DB: `libsql://vyzor-scopedb-vinnsedesigner.aws-us-west-2.turso.io` (location: aws-us-west-2)
- DB-scoped token: `$TURSO_VYZOR_SCOPE_DB_TOKEN` secret (read directly by the server)
- Platform token: `$TURSO_AUTH_TOKEN` secret (use as `TURSO_API_TOKEN` for `turso` CLI management)
- Tables: `_migrations`, `api_keys`, `recordings`, `sessions`, `settings`, `user_preferences`, `waveforms`
- Verified end-to-end (2026-08-08): migrations apply, CRUD via GraphQL (createSession/createSettings/endSession/pinRecording), reads (sessions/dashboardSummary/recentRecordings/settings), REST `/api/recordings/<id>/metadata` — all persist to cloud DB.

## GraphQL Schema Notes
- Recordings: `createRecording`, `recording(id)`, `recordings(filter)`, `recentRecordings`, `renameRecording`, `pinRecording`, `deleteRecording`, `deleteRecordings`
- Sessions: `createSession`, `session(id)`, `sessions`, `updateSessionDsp(id, input)`, `endSession`
- Settings: `settings(sessionId)`, `updateSettings`
- Use `input` wrapper for mutation arguments (e.g. `updateSessionDsp(id, input: {...})`)
- Static content (no device scoping): `aboutInfo`, `features`, `changelog` — served from JSON embedded via `include_str!("../../data/*.json")` at compile time, so it works in Docker containers without the `data/` dir on disk.

## Device-ID Scoping (IMPORTANT)
- **No user-facing auth.** Sessions/preferences are scoped to a device via the `X-Device-Id` HTTP header (no sign-up/login). A larger platform will wrap this app as a feature with its own auth later.
- Frontend: `apps/vyzorWeb/src/hooks/use-device-id.ts` (`useDeviceId`) generates/persists a UUID per browser (localStorage). The api-client attaches it as `X-Device-Id` on every request and as a query param on the WS connection.
- Backend: `extract_auth_header` middleware reads `Authorization` + `X-Device-Id` and inserts them as `AuthHeaderExt(Option<String>)` / `DeviceIdExt(Option<String>)` newtype wrappers into the request extensions. **These must be distinct types** — axum's `Extension` map is keyed by type, so two `Option<String>` inserts collide and the second overwrites the first (previously caused the device-id value to clobber the auth-header value, breaking all auth).
- `RequestIdentity` (built in `graphql_handler`) carries `device_id` + `is_system_client` + `api_key`; resolvers read it via `ctx.data::<RequestIdentity>()` and use `device_scope_from_context(ctx)` to scope queries/mutations.
- Ownership checks: batch recording ops (`deleteRecording`, `deleteRecordings`, `pinRecordings`) verify each item belongs to the device. Subscription resolvers (`waveform_subscribe`, `spectrum_subscribe`, etc.) verify session ownership before streaming. `endSession`/`updateSessionDsp` only affect sessions owned by the requesting device.
- **WebSocket auth + scoping:** The WS handshake (`/ws`) is behind the same `extract_auth_header` middleware. Because browsers cannot set custom headers on a WebSocket handshake, the frontend also sends `X-Device-Id` and `X-Api-Key` as query params (`WsHandshakeQuery`), which the `ws_handler` merges with any header values. The handler authenticates the bootstrap/API key (401 on failure), builds a `RequestIdentity`, and passes it + the `SessionService` into `handle_socket`. Every `Subscribe`/`SubscribeSpectrum`/`WaveformData`/`AnalysisData` message is checked by `verify_ws_session_ownership` against `session.user_id == device_id` before acting — so a device cannot subscribe to or publish into another device's session.
- User preferences: `prefs_id` = device id (falls back to `"default"` for system/admin calls with no device id).
- Verified end-to-end: device A's sessions/preferences are invisible to device B; unauthenticated requests are rejected.

## GraphQL Subscriptions over WebSocket (Apollo `graphql-ws` protocol)
- The app exposes TWO WebSocket endpoints — do not confuse them:
  - `/ws` — legacy binary streaming protocol (waveform/spectrum frames, `Subscribe`/`WaveformData` JSON messages). Used by `use-waveform-stream.ts`.
  - `/graphql/ws` — Apollo `graphql-transport-ws` subprotocol for `@apollo/client` subscriptions (`analysisSubscribe`, etc.). Used by `use-scope-capture.ts` via the Apollo `WebSocketLink`.
- Backend (`rust/src/api/server_graphql.rs`): `graphql_ws_handler` serves `/graphql/ws`. The `WebSocketUpgrade` MUST call `.protocols(["graphql-transport-ws"])` so axum echoes the subprotocol back — without it the browser's `WebSocket` never fires `open` (subprotocol negotiation fails). `GraphqlWsHandshakeQuery` reads `X-Device-Id` / `X-Api-Key` from serde-renamed query params and authenticates the same way as `/ws`.
- Frontend (`packages/api-client/src/audioScopeView/graphql/client.ts`): the Apollo `WebSocketLink` connects to `ws(s)://<host>/graphql/ws?X-Device-Id=<deviceId>` (device id appended as a query param because browsers cannot set custom headers on a WS handshake). `@apollo/client/link/ws` depends on `subscriptions-transport-ws` as a peer dep — install it (`pnpm --filter @audio-scope-view/vyzor-web add subscriptions-transport-ws`) or the import resolves to `undefined` and subscriptions silently never connect.
- Static-server proxy (`apps/vyzorWeb/scripts/static-server.cjs`): the WS upgrade handler proxies `/graphql/ws` (and `/ws`) to the backend. CRITICAL: the `http.request`/`http.upgrade` options MUST include `port: 8080` — without it Node defaults the target port to 80 and the upgrade fails silently. Also inject `X-Device-Id` / `Authorization` headers into the proxied WS handshake request when the browser omits them.
- Verification: a working subscription shows `GQL-WS: AUTH OK (device: <id>)` in the backend log and NO `ws close`/`error` lines. Direct test against 8080 and through the 3003 proxy should both reach `connection_ack`.

## Apollo Error Toast Sanitization
- `apps/vyzorWeb/src/lib/format-error.ts` `formatError(error)` is the single entry point for all user-facing toasts. It strips `http(s)://` and `ws(s)://` URLs from messages, collapses whitespace, and maps `Failed to fetch` / `NetworkError` / `Load failed` to `"Network error: unable to reach the server. Check your connection and try again."` so internal endpoints (`http://127.0.0.1:8080/graphql`) never leak to the UI.
- `packages/api-client/src/audioScopeView/graphql/client.ts` `sanitizeErrorMessage` does the same for Apollo `onError` link messages.

## DB Backend Selection (recap — got bitten by this)
- `DatabaseConnection::new(config.database.url)` picks Turso iff the URL starts with `libsql://`, else local SQLite. Config default is `sqlite:./data/audio_scope_view.db`.
- Restarting the backend WITHOUT `APP__DATABASE__URL=$TURSO_DB_URL` silently falls back to a **fresh local SQLite** DB (0 recordings) even though `TURSO_*` env vars are set — the env vars alone do NOT select Turso; only the `libsql://` URL does. Always launch with `APP__DATABASE__URL="$TURSO_DB_URL"`.
- The local SQLite file location depends on the process CWD (`./data/audio_scope_view.db` relative to wherever the binary is launched), so `rust/data/` vs repo-root `data/` can both exist and diverge.

## Device-scoped data access (security fix)
- The `X-Device-Id` header is the data-isolation dimension. `is_valid_device_id()` in `rust/src/shared/constants.rs` validates canonical UUID form (`8-4-4-4-12` hex) and the legacy `dev-<base36>-<base36>` fallback. Malformed ids are rejected with HTTP 400 at the middleware (`server_graphql.rs::extract_auth_header`) and both WS handshake handlers (`ws_handler`, `graphql_ws_handler`).
- Device scoping is enforced at the **resolver** layer via ownership helpers (`assert_session_ownership`, `assert_settings_session_owned`, `assert_waveform_session_owned`): before reading/mutating a session-scoped resource, verify the session's `user_id` equals the requesting device id. Unscoped admins (bootstrap key, no device id) bypass the check. Denials return "not found" rather than "forbidden" to avoid leaking existence.
- Settings CRUD, Waveform CRUD, `capture`, `updateSessionDsp`, `createSubSession`, `subSessions`, `parentSession`, `exportWaveform`, and `startBatchCapture` all enforce ownership. API key management (`apiKeys`, `apiKey`, `verifyApiKey`, `createApiKey`, `updateApiKey`, `deleteApiKey`) is gated behind `assert_admin` (bootstrap-only).
- `static-server.cjs` explicitly forwards `X-Device-Id` (not just via `...req.headers` spread) in the `/graphql`, `/api/`, and WS upgrade proxy paths.
- `createSession` derives `user_id` from the request device id (ignores client-supplied `input.user_id` for non-admins).

## Live audio backend (mocks/stubs removed — cpal is the only backend)
- The Rust backend now has a **single** audio backend: cpal (live capture from a physical or virtual input device). The `mock-audio`, `pulse`, and `real-audio` cargo features and the `audio_capture_mock.rs` / `audio_capture_pulse.rs` / `audio_capture_alsa.rs` stub files have been **deleted**. `cpal` is now a non-optional dependency (`cpal = "0.15"` in `Cargo.toml`); build with a plain `cargo build --release` (no `--features` flag).
- `AudioBackendType` is a single-variant enum (`Real` only), kept for the `AudioStreamManager::backend_type()` logging API. `AudioConfig` in `config_loader.rs` is now an empty struct whose `backend_type()` always returns `Real`; the `[audio] backend = "..."` config key / `APP__AUDIO__BACKEND` env var are **ignored** (there is no longer a choice to make). The `[audio]` section was removed from `config.toml`.
- `AudioStreamManager` always uses `RealAudioCapture`: `new()` / `with_backend(_)` (arg ignored, kept for compat) / `init_capture()` / `capture_once(duration_ms)` / `list_devices()` all instantiate cpal directly. The `MockAudioCapture` and `PulseAudioCapture` `AudioCaptureBackend` impls were deleted; only the `RealAudioCapture` impl remains.
- The `capture` GraphQL mutation calls `context.audio_manager.capture_once(duration_ms)` (the `AudioStreamManager` is injected into `GraphqlContext` via `AppState::new`); the old hardcoded `MockAudioCapture` sine-wave path is gone. `CaptureSettingsInput.frequency`/`amplitude`/`noise_level` are accepted but ignored by the live backend; only `duration_ms` matters.
- **Build deps:** cpal needs `pkg-config` + `libasound2-dev` (ALSA headers) at compile time. cpal probes ALSA devices at runtime via the `libasound2` ALSA plugins.
- **Runtime audio source in this sandbox:** no `/dev/snd` hardware and `modprobe snd-aloop` fails (no CAP_SYS_ADMIN). The only viable source is a **PulseAudio system daemon** with its null-sink monitor (`auto_null.monitor`). Start it system-wide (non-root `--system` is refused; must run as root/sudo): set up an auth cookie at `/var/run/pulse/.pulse-cookie` (and `/var/run/pulse/.config/pulse/cookie`), then `PULSE_RUNTIME_PATH=/var/run/pulse pulseaudio --system --disallow-exit --realtime=false`. Copy the cookie to `~/.config/pulse/cookie` + `~/.pulse-cookie` for the non-root backend process and export `PULSE_SERVER=/var/run/pulse/native` + `PULSE_COOKIE=~/.pulse-cookie`.
- **Harmless noise:** cpal/ALSA emits many `ALSA lib confmisc.c: Cannot get card index for 0`, `Cannot open device /dev/dsp`, and JACK `Cannot connect to server socket` warnings while probing — these are expected in a headless container and do not prevent the PulseAudio `pulse`/`default` devices (2 ch, 44100 Hz) from being found and opened.
- **Run command:** `BOOTSTRAP_KEY=... APP__DATABASE__URL="$TURSO_DB_URL" APP__DATABASE__TOKEN="$TURSO_VYZOR_SCOPE_DB_TOKEN" PULSE_SERVER=/var/run/pulse/native PULSE_COOKIE=~/.pulse-cookie RUST_LOG=info ./target/release/audio-scope-view` (no `APP__AUDIO__BACKEND` needed; no `--features` flag). Verified: `capture` returns 6615 samples @ 44100 Hz for a 150 ms request via the cpal backend.
- **Known pre-existing test failure (unrelated):** `audio_capture_real::tests::test_ring_buffer_wrap` fails (`push` returns 7, test expects 9) — this is a bug in the `AudioRingBuffer` push/drain logic in `audio_capture_real.rs`, NOT related to the mock removal (that file was not touched).
