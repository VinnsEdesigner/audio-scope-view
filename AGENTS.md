# audio-scope-view

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
