# Architecture Restructuring: Scopes → Sessions

## Overview

Refactor the application to replace the "Scope" concept with "Session" in the API layer, aligning with how users actually think about oscilloscope usage.

**STATUS**: ✅ Backend API refactoring complete - session naming throughout

---

## Concepts

### Session (NEW - API Layer)
- **What**: Ephemeral record of a live canvas instance
- **Lifecycle**: Auto-created when canvas opens, auto-saved after ~1 minute of running
- **User Input**: None - fully automated
- **Data Stored**: 
  - `id` (UUID)
  - `user_id` (from auth - optional)
  - `started_at` (timestamp)
  - `ended_at` (timestamp - nullable)
  - `duration_seconds` (calculated when ended)
- **Persistence**: Saved to DB via sessions table, shown in Sessions list on home page

### Recording (EXISTING - Unchanged)
- **What**: User-saved named artifact of captured audio/data
- **Lifecycle**: Explicitly created by user action
- **User Input**: Name, manual save trigger
- **Persistence**: Persistent until deleted
- **Note**: Still references `scope_id` in database for backwards compatibility

### Scope (DEPRECATED)
- **What**: Was acting as both a container and a UI state holder
- **Action**: Deprecated in API layer - no longer exposed to users
- **Backend DB**: Still exists (recordings, waveforms, settings tables reference scope_id)
- **Internal**: Audio stream manager still uses scope_id internally

---

## Backend Changes (COMPLETED)

### API Layer Changes ✅
| Old (Scope API) | New (Session API) | Status |
|----------------|-------------------|--------|
| `Query.scopes` | `Query.sessions` | ✅ Renamed |
| `Query.scope` | `Query.session` | ✅ Renamed |
| `Query.scopeCount` | `Query.sessionCount` | ✅ Renamed |
| `Mutation.createScope` | `Mutation.createSession` | ✅ Renamed |
| `Mutation.updateScope` | - (removed) | ✅ Removed |
| `Mutation.deleteScope` | `Mutation.deleteSession` | ✅ Renamed |
| `Mutation.capture` | `Mutation.capture` | ✅ Updated to use sessionId |
| - | `Mutation.endSession` | ✅ New |
| - | `Mutation.sessionHeartbeat` | ✅ New |

### Database Changes
- Migration v5 added: `005_create_sessions.sql`
  - Creates `sessions` table with new schema
  - Renames `recordings.scope_id` → `session_id` (via ALTER TABLE)
- Original `scopes` table kept for backwards compatibility

### Files Updated
- `src/domain/entity_session.rs` - Session entity (renamed from entity_scope.rs)
- `src/domain/mod.rs` - Updated exports
- `src/domain/trait_session_repository.rs` - SessionRepository trait (renamed from trait_scope_repository.rs)
- `src/api/schema_session.rs` - SessionQuery/SessionMutation (renamed from schema_scope.rs)
- `src/api/resolver_session.rs` - SessionResolver (renamed from resolver_scope.rs)
- `src/api/schema_root.rs` - Updated imports
- `src/api/mod.rs` - Updated module declarations
- `src/application/service_scope.rs` - Updated to SessionService methods
- `src/application/service_dashboard.rs` - Updated to work with Sessions
- `src/application/service_recording.rs` - Updated scope→session in queries
- `src/infrastructure/repo_sqlite_session.rs` - Session repository
- `src/infrastructure/database_migrations.rs` - Added v5 migration
- `src/infrastructure/audio_stream_manager.rs` - Uses session_id throughout, renamed internal field and methods

---

## GraphQL Schema (Session API)

### SessionOutput
```graphql
type SessionOutput {
    id: String!
    startedAt: String!
    endedAt: String
    durationSeconds: Int
    recordingCount: Int!
}
```

### Session Queries
```graphql
type SessionQuery {
    sessions(limit: Int, offset: Int): [SessionOutput!]!
    session(id: String!): SessionOutput
    sessionCount: Int!
}
```

### Session Mutations
```graphql
type SessionMutation {
    createSession: SessionOutput!
    endSession(id: String!): SessionOutput
    sessionHeartbeat(id: String!): Boolean!
    deleteSession(id: String!): Boolean!
    capture(sessionId: String!, settings: CaptureSettingsInput): WaveformOutput
}
```

---

## Frontend Changes (TODO)

### Home Page
- **Remove**: "Scopes" tab entirely
- **Add**: "Sessions" section showing list of session IDs with duration, timestamp
- **Button**: "Open Oscilloscope" → creates new session via `createSession` mutation

### Oscilloscope Route
- **OLD**: `/scope/:scopeId`
- **NEW**: `/oscilloscope` (no ID parameter)
- **Internal State**: Manages current `sessionId` in React state/context
- **On Mount**: Call `createSession` → store sessionId
- **Timer**: After ~1 minute, call `endSession(sessionId)`
- **Heartbeat**: Optional - `sessionHeartbeat` every 30s

### Recordings Tab
- Keep existing functionality
- Recordings still reference `scope_id` for backwards compatibility

---

## Data Flow

### Session Lifecycle
```
[User clicks "Open Oscilloscope"]
         │
         ▼
[POST /session] ──► Backend creates session record
         │
         ▼
[Returns session_id] ◄─── Frontend stores in state
         │
         ▼
[Canvas renders, timer starts (~1min)]
         │
         ▼
[After 60s: endSession(session_id)]
         │
         ▼
[Session saved to list]
```

---

## Migration Status

### Phase 1: Backend API ✅ COMPLETE
- [x] Create Session entity replacing Scope
- [x] Create sessions table migration
- [x] Update GraphQL schema (scope → session)
- [x] Update services to use Session
- [x] Update repository to Session model
- [x] Add session lifecycle methods (create, end, heartbeat, delete)

### Phase 2: Frontend ⏳ TODO
- [ ] Update home page - remove scopes, add sessions
- [ ] Update oscilloscope route - remove :scopeId param
- [ ] Add session management hook
- [ ] Update recordings to send session_id

### Phase 3: Backend Cleanup ✅ COMPLETE
- [x] Update domain types (Waveform, Settings) to use session_id
- [x] Update audio_stream_manager to use session_id
- [x] Rename files: entity_scope → entity_session, trait_scope_repository → trait_session_repository
- [x] Rename API files: schema_scope → schema_session, resolver_scope → resolver_session
- [x] Update tests
- [x] Update documentation
