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
