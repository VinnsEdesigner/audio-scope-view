# Session Management Architecture

## Overview

This document describes the comprehensive session management system for Audio Scope View. Sessions are ephemeral containers that track live capture activities, recordings, and oscilloscope data. All recording and oscilloscope activities must be associated with a session.

---

## Current Implementation Status

### ✅ Server (Rust Backend) - Mostly Complete

| Component | Status | Details |
|-----------|--------|---------|
| Session Entity | ✅ Done | `rust/src/domain/entity_session.rs` |
| Session Repository | ✅ Done | `rust/src/infrastructure/repo_sqlite_session.rs` |
| Session GraphQL Schema | ✅ Done | `rust/src/api/schema_session.rs` |
| Recording Schema | ✅ Done | `rust/src/api/schema_recording.rs` |
| Database Migrations | ✅ Done | Sessions + oscilloscope fields |

### ✅ API Client (TypeScript) - Mostly Complete

| Component | Status | Details |
|-----------|--------|---------|
| Session Types | ✅ Done | `packages/api-client/src/domain/session/types.ts` |
| Session Hooks | ✅ Done | `apps/vyzorWeb/src/hooks/use-sessions.ts` |
| Session GraphQL Queries | ✅ Done | `packages/api-client/src/audioScopeView/graphql/queries/session-queries.ts` |
| Session GraphQL Mutations | ✅ Done | `packages/api-client/src/audioScopeView/graphql/mutations/session-mutations.ts` |

### ⚠️ Frontend (React) - Needs Implementation

| Component | Status | Details |
|-----------|--------|---------|
| Home Page | ⚠️ Partial | Basic session display, no session enforcement |
| DialogMicRecording | ⚠️ Partial | Has sessionId prop, no enforcement |
| Scope Page | ⚠️ Partial | No session enforcement on probe |
| Session Page | ❌ Missing | New route needed |
| Session Selection Dialog | ❌ Missing | New component needed |
| Settings - Session Options | ❌ Missing | New settings section needed |

---

## Data Model

### Session Entity (Backend)

```rust
pub struct Session {
    pub id: String,
    pub user_id: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i64>,
    pub oscilloscope_opened_at: Option<DateTime<Utc>>,
    pub oscilloscope_duration_ms: Option<f64>,
}
```

### Required Extensions

#### Backend Changes Needed

1. **Add to Session Entity**:
   - `name: Option<String>` - User-friendly session name
   - `description: Option<String>` - Optional description
   - `parent_session_id: Option<String>` - For sub-sessions (30s auto-create)
   - `is_sub_session: bool` - Flag to identify auto-created sub-sessions
   - `auto_close_timeout_secs: Option<i32>` - Configurable auto-close (default: 30)

2. **New GraphQL Mutations**:
   - `create_sub_session(parentId: String!) -> SessionOutput` - Auto-create when 30s live
   - `get_last_used_session() -> Option<SessionOutput>` - For settings
   - `set_last_used_session(sessionId: String!) -> Bool` - Persist preference

3. **New Recording Fields**:
   - `sub_session_id: Option<String>` - Links recording to sub-session if applicable

#### Frontend Types Needed

```typescript
// New in packages/api-client/src/domain/session/types.ts

export interface SessionSettings {
  autoSelectSession: boolean;
  lastUsedSessionId: string | null;
  alwaysPromptSession: boolean;
}

export interface CreateSessionInput {
  name?: string;
  description?: string;
}
```

---

## User Flows

### Flow 1: Test Recording with Session Enforcement

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HOME PAGE                                   │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   Recent    │    │   Active    │    │   Session   │             │
│  │  Recordings │    │   Sessions  │    │   Actions   │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│                                                                     │
│                          ▼                                          │
│                   [🎤 Test Recording]                               │
│                          │                                          │
│                          ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              CHECK SESSION SETTINGS                          │   │
│  │                                                               │   │
│  │  autoSelectSession = true?                                   │   │
│  │       │                                                       │   │
│  │       ├─── YES ───► Use lastUsedSessionId                    │   │
│  │       │                │                                      │   │
│  │       │                ▼                                      │   │
│  │       │         lastUsedSessionId exists?                      │   │
│  │       │              │     │                                   │   │
│  │       │         YES  │     │  NO                                │   │
│  │       │              ▼     ▼                                    │   │
│  │       │        Continue   Show Session Dialog                   │   │
│  │       │             │    │                                      │   │
│  │       NO ──────────┴────┘                                      │   │
│  │        │                                                        │   │
│  └────────┼────────────────────────────────────────────────────────┘   │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │              SESSION SELECTION DIALOG                        │     │
│  │                                                               │     │
│  │  ┌─────────────────────────────────────────────────────┐      │     │
│  │  │  [ Select Existing Session    ▼ ]                  │      │     │
│  │  └─────────────────────────────────────────────────────┘      │     │
│  │                                                               │     │
│  │         OR                                                     │     │
│  │                                                               │     │
│  │  ┌─────────────────────────────────────────────────────┐      │     │
│  │  │  [ + Create New Session ]                          │      │     │
│  │  └─────────────────────────────────────────────────────┘      │     │
│  │                                                               │     │
│  │  Session Name: [________________]                            │     │
│  │  Description:  [________________]                              │     │
│  │                                                               │     │
│  │  [Cancel]                        [Create / Select Session]    │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │          OPEN RECORDING DIALOG (with sessionId)              │     │
│  │                                                               │     │
│  │  Session: "Morning Session"  [Change]                         │     │
│  │  ─────────────────────────────────────────                    │     │
│  │                                                               │     │
│  │  [Device ▼]  [Start Recording]                               │     │
│  │                                                               │     │
│  │  ┌───────────────────────────────────────────────────────┐   │     │
│  │  │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   │     │
│  │  └───────────────────────────────────────────────────────┘   │     │
│  │                                                               │     │
│  │  Duration: 00:15    [Pause] [Stop & Save]                    │     │
│  └─────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 2: Oscilloscope Route Enforcement

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HOME PAGE                                   │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   Recent    │    │   Active    │    │   Open      │             │
│  │  Recordings │    │   Sessions  │    │ Oscilloscope│             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│                                             │                        │
│                                             ▼                        │
│                                     [🔊 Oscilloscope]               │
│                                             │                        │
│                                             ▼                        │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │              CHECK SESSION & OPEN OSCILLOSCOPE              │     │
│  │                                                               │     │
│  │  User has active session?                                    │     │
│  │       │                                                       │   │
│  │       ├─── YES ───► Open oscilloscope with sessionId        │   │
│  │       │                (mark oscilloscope_opened_at)          │   │
│  │       │                                                       │   │
│  │       NO ────────────────────────────────────────────        │   │
│  │        │                                                        │   │
│  └────────┼────────────────────────────────────────────────────────┘   │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │          SESSION SELECTION DIALOG (required)                 │     │
│  │                                                               │     │
│  │  "You must select a session to open the oscilloscope"        │     │
│  │                                                               │     │
│  │  [ Select from existing sessions / Create new ]              │     │
│  │                                                               │     │
│  │  [Cancel]                        [Select Session]             │     │
│  └─────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 3: 30-Second Auto Sub-Session Creation

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OSCILLOSCOPE - LIVE MODE                        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                        PROBE                                 │     │
│  │                          │                                   │     │
│  │                          ▼                                   │     │
│  │  ┌─────────────────────────────────────────────────────┐    │     │
│  │  │              START CAPTURE                           │    │     │
│  │  │                   │                                 │    │     │
│  │  │                   ▼                                 │    │     │
│  │  │  ┌─────────────────────────────────────────────┐    │    │     │
│  │  │  │         CAPTURE TIMER = 0                    │    │    │     │
│  │  │  │              │                              │    │    │     │
│  │  │  │              │ Timer +1s                     │    │    │     │
│  │  │  │              ▼                              │    │    │     │
│  │  │  │  Timer >= 30s without stopping?              │    │    │     │
│  │  │  │         │              │                      │    │    │     │
│  │  │  │    YES  │              │  NO                   │    │    │     │
│  │  │  │         ▼              │                      │    │    │     │
│  │  │  │  ┌──────────────┐      │                      │    │    │     │
│  │  │  │  │ AUTO-CREATE  │      │                      │    │    │     │
│  │  │  │  │ SUB-SESSION  │      │                      │    │    │     │
│  │  │  │  └──────────────┘      │                      │    │    │     │
│  │  │  │         │              │                      │    │    │     │
│  │  │  │         ▼              │                      │    │    │     │
│  │  │  │  parent_session_id     │                      │    │    │     │
│  │  │  │  = current session     │                      │    │    │     │
│  │  │  │  is_sub_session = true │                      │    │    │     │
│  │  │  │  Reset Timer = 0        │                      │    │    │     │
│  │  │  │         │              │                      │    │    │     │
│  │  │  └─────────┼──────────────┘                      │    │     │
│  │  │            │                                     │    │     │
│  │  │            ▼                                     │    │     │
│  │  │     Continue Capture                            │    │     │
│  │  │            │                                     │    │     │
│  │  │  Timer >= 30s ──► Repeat auto-create             │    │     │
│  │  └─────────────────────────────────────────────────┘    │     │
│  │            │                                              │     │
│  │            ▼                                              │     │
│  │  [Pause] [Stop & Save Recording]                          │     │
│  │              │                                             │     │
│  │              ▼                                             │     │
│  │  Recording created with sub_session_id reference           │     │
│  └─────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 4: Session Page

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SESSION PAGE                                │
│                  (/session/:sessionId)                               │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  [← Back to Home]                                           │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  SESSION HEADER                                              │     │
│  │  ───────────────────────────────────────────────────────    │     │
│  │  Name: "Morning Lab Session"                   [Edit]       │     │
│  │  Created: Jan 15, 2024 at 9:30 AM                           │     │
│  │  Status: 🟢 Live                                            │     │
│  │  Duration: 45m 30s                                          │     │
│  │  Parent: (none) or "Session #abc123"                       │     │
│  │                                                             │     │
│  │  [End Session]  [Delete Session]                           │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  SUB-SESSIONS (if any)                                      │     │
│  │  ───────────────────────────────────────────────────────    │     │
│  │  ┌─────────────────────────────────────────────────────┐    │     │
│  │  │ Sub-Session #1  |  Duration: 32s  |  2 recordings │    │     │
│  │  └─────────────────────────────────────────────────────┘    │     │
│  │  ┌─────────────────────────────────────────────────────┐    │     │
│  │  │ Sub-Session #2  |  Duration: 28s  |  1 recording │    │     │
│  │  └─────────────────────────────────────────────────────┘    │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  SESSION STATISTICS                                         │     │
│  │  ───────────────────────────────────────────────────────    │     │
│  │  Total Recordings: 15                                      │     │
│  │  Total Duration: 2h 15m                                     │     │
│  │  Total Size: 125.4 MB                                       │     │
│  │  Oscilloscope Time: 45m 30s                                 │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  RECORDINGS IN THIS SESSION                                 │     │
│  │  ───────────────────────────────────────────────────────    │     │
│  │  ┌─────────────────────────────────────────────────────┐    │     │
│  │  │ 📹 Recording 1    |  2m 30s  |  12.4 MB  |  10:30 AM│    │     │
│  │  └─────────────────────────────────────────────────────┘    │     │
│  │  ┌─────────────────────────────────────────────────────┐    │     │
│  │  │ 📹 Recording 2    |  1m 15s  |   6.2 MB  |  10:35 AM│    │     │
│  │  └─────────────────────────────────────────────────────┘    │     │
│  │       ...                                                    │     │
│  │  [Load More]                                                 │     │
│  └─────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Session Selection Dialog (`dialog-session-select.tsx`)

**Purpose**: Modal dialog for creating new sessions or selecting existing ones.

**Props**:
```typescript
interface DialogSessionSelectProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionSelected: (sessionId: string) => void;
  onSessionCreated: (sessionId: string) => void;
  required?: boolean;  // If true, cannot dismiss without selection
  excludeSessionIds?: string[];  // Sessions to exclude from list
}
```

**States**:
- `mode: "select" | "create"`
- `selectedSessionId: string | null`
- `newSessionName: string`
- `newSessionDescription: string`
- `isLoading: boolean`
- `error: string | null`

**UI Elements**:
- Radio buttons or cards for existing sessions
- "Create New" tab/button
- Form fields for name and description
- Cancel/Select buttons
- Loading states

### 2. Session Page (`routes/session-page.tsx`)

**Route**: `/session/:sessionId`

**Data Requirements**:
- Session details (id, name, status, timestamps)
- Parent session info (if sub-session)
- Sub-sessions list (if parent session)
- Recordings in session (paginated)
- Session statistics

**UI Sections**:
- Header with session info and actions
- Sub-sessions list (collapsible)
- Statistics cards
- Recordings list with pagination

### 3. Settings - Session Options

**New Section**: "Sessions" in Settings page

**Options**:
```typescript
interface SessionSettingsOptions {
  autoSelectLastSession: boolean;  // Default: false
  // When true: Use last selected session automatically
  // When false: Always show session selection dialog
  
  defaultSessionTimeout: number;  // Default: 30 (seconds)
  // Auto-create sub-session after this duration
}
```

**Storage**: Persist in localStorage or user preferences API

---

## API Endpoints (GraphQL)

### New Queries

```graphql
# Get session with all details including sub-sessions
query GetSessionDetails($id: String!) {
  session(id: $id) {
    ...SessionFields
    name
    description
    parentSessionId
    isSubSession
    subSessions {
      ...SessionFields
    }
    recordings(limit: 20, offset: 0) {
      ...RecordingSummaryFields
    }
  }
}

# Get last used session (for auto-select)
query GetLastUsedSession {
  lastUsedSession {
    ...SessionFields
  }
}
```

### New Mutations

```graphql
# Create a named session
mutation CreateNamedSession($input: CreateSessionInput!) {
  createNamedSession(input: $input) {
    ...SessionFields
    name
    description
  }
}

# Create sub-session (auto-called at 30s)
mutation CreateSubSession($parentId: String!) {
  createSubSession(parentId: $parentId) {
    ...SessionFields
    parentSessionId
    isSubSession
  }
}

# Set last used session
mutation SetLastUsedSession($sessionId: String!) {
  setLastUsedSession(sessionId: $sessionId)
}
```

---

## State Management

### Frontend State (Zustand)

```typescript
// Current session state
interface SessionState {
  // Current active session
  activeSessionId: string | null;
  
  // Settings
  autoSelectSession: boolean;
  lastUsedSessionId: string | null;
  
  // Actions
  setActiveSession: (id: string) => void;
  clearActiveSession: () => void;
  setAutoSelect: (value: boolean) => void;
  setLastUsed: (id: string) => void;
}

// Capture tracking for 30s auto-sub-session
interface CaptureTrackingState {
  sessionId: string | null;
  captureStartTime: number | null;
  isPaused: boolean;
  accumulatedTime: number;  // Time before pauses
}
```

---

## Implementation Order

### Phase 1: Backend Extensions
1. Add `name`, `description`, `parent_session_id`, `is_sub_session` to Session entity
2. Add migration for new fields
3. Add `create_named_session` mutation
4. Add `create_sub_session` mutation
5. Add `get_last_used_session` / `set_last_used_session` mutations (or use localStorage)

### Phase 2: API Client Extensions
1. Update TypeScript Session types
2. Add GraphQL queries and mutations
3. Create session hooks

### Phase 3: Session Selection Dialog
1. Create `dialog-session-select.tsx`
2. Integrate into home page before opening recording
3. Handle "required" mode for oscilloscope

### Phase 4: Session Enforcement Logic
1. Home page: Check session settings before opening recording dialog
2. Oscilloscope route: Require session before probe
3. Implement 30-second capture timer logic

### Phase 5: Session Page
1. Create `session-page.tsx` route
2. Display session details, sub-sessions, recordings
3. Add session statistics

### Phase 6: Settings Integration
1. Add session options section to settings
2. Implement auto-select logic
3. Persist last used session

---

## Testing Requirements

### Unit Tests
- Session entity methods (parent/child relationships)
- 30-second timer logic
- Settings persistence

### Integration Tests
- Session creation flow
- Recording with session association
- Sub-session auto-creation
- Session page data loading

### E2E Tests
- Full recording flow with session selection
- Oscilloscope with session enforcement
- Sub-session creation during capture
- Settings persistence

---

## Error Handling

### Session Not Found
- Display error state with option to return home
- Clear invalid session from localStorage

### Session Creation Failed
- Show error toast
- Allow retry
- Log error for debugging

### Sub-Session Creation Failed
- Continue with current session (graceful degradation)
- Log error but don't interrupt capture

### Network Errors
- Use cached session data when offline
- Sync when connection restored
- Show appropriate error messages

---

## Migration Strategy

### Database Migration
```sql
-- Migration: Add session hierarchy and metadata
ALTER TABLE sessions ADD COLUMN name TEXT;
ALTER TABLE sessions ADD COLUMN description TEXT;
ALTER TABLE sessions ADD COLUMN parent_session_id TEXT REFERENCES sessions(id);
ALTER TABLE sessions ADD COLUMN is_sub_session BOOLEAN DEFAULT FALSE;
ALTER TABLE sessions ADD COLUMN auto_close_timeout_secs INTEGER DEFAULT 30;

-- Add foreign key for parent sessions
CREATE INDEX idx_sessions_parent ON sessions(parent_session_id);
```

### Frontend State Migration
- Version localStorage schema
- Provide migration function for existing users
- Default new users to `autoSelectSession: false`
