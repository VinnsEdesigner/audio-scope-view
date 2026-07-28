# DRAFT: Home Page Data Layer Summary

## Overview

This document summarizes all domain types, queries, and mutations needed to implement the Home page design.

---

## 1. Domain Types Created

**Location:** `packages/api-client/src/domain/recording/`

### Types (`types.ts`)

| Type | Description |
|------|-------------|
| `Recording` | Full recording with samples, size, pin status |
| `RecordingSummary` | Lightweight recording for lists (no samples) |
| `RecordingListParams` | Query parameters for listing |
| `RecordingListResult` | Paginated list result |
| `RecordingStats` | Dashboard stats (counts, sizes) |
| `ScopeWithStatus` | Extended Scope with status (live/paused/offline) |
| `ScopeListResult` | Paginated scope list result |
| `ScopeStatus` | Union type: `"live" | "paused" | "offline"` |
| `TimeRange` | Union type: `"last_hour" | "last_24_hours" | "last_7_days" | "last_30_days"` |

### Transforms (`transforms.ts`)

- `transformRecording()` - Server → Domain
- `transformRecordingSummary()` - Server → Domain
- `transformRecordingListResult()` - Server → Domain
- `transformRecordingStats()` - Server → Domain
- `transformScopeWithStatus()` - Server → Domain
- `transformScopeListResult()` - Server → Domain

---

## 2. GraphQL Queries Created

**Location:** `packages/api-client/src/audioScopeView/graphql/queries/recording-queries.ts`

### Recording Queries

| Query | Purpose |
|-------|---------|
| `GET_RECORDINGS` | List recordings with filters (timeRange, scopeId, pinnedOnly) |
| `GET_RECORDING` | Get single recording with full details |
| `GET_RECORDING_STATS` | Dashboard stats (total recordings, size, duration) |
| `GET_RECENT_RECORDINGS` | Get N most recent recordings |

### Scope Status Queries

| Query | Purpose |
|-------|---------|
| `GET_SCOPES_WITH_STATUS` | List scopes with live/paused/offline status |
| `GET_ACTIVE_SCOPES_WITH_STATUS` | Get only scopes with status = "live" |
| `GET_SCOPE_STATUS_COUNTS` | Get counts by status type |

---

## 3. GraphQL Mutations Created

**Location:** `packages/api-client/src/audioScopeView/graphql/mutations/recording-mutations.ts`

### Recording Mutations

| Mutation | Purpose |
|----------|---------|
| `RENAME_RECORDING` | Rename a recording |
| `PIN_RECORDING` | Pin/unpin a recording |
| `DELETE_RECORDING` | Delete a single recording |
| `START_RECORDING` | Start a new recording capture |
| `STOP_RECORDING` | Stop an active recording |
| `PAUSE_RECORDING` | Pause a recording |
| `RESUME_RECORDING` | Resume a paused recording |
| `PIN_RECORDINGS` | Bulk pin/unpin |
| `DELETE_RECORDINGS` | Bulk delete |

---

## 4. React Hooks Created

**Location:** `apps/vyzorWeb/src/hooks/`

### Recording Hooks (`use-recordings.ts`)

| Hook | Purpose |
|------|---------|
| `useRecordings(options)` | Fetch paginated recording list |
| `useRecentRecordings(limit)` | Fetch N recent recordings |
| `useRecordingStats(timeRange)` | Fetch dashboard stats |
| `useRenameRecording()` | Mutation hook for rename |
| `usePinRecording()` | Mutation hook for pin/unpin |
| `useDeleteRecording()` | Mutation hook for delete |
| `usePinRecordings()` | Bulk pin mutation |
| `useDeleteRecordings()` | Bulk delete mutation |

### Scope Status Hooks (`use-scopes-with-status.ts`)

| Hook | Purpose |
|------|---------|
| `useScopesWithStatus(options)` | Fetch paginated scopes with status |
| `useActiveScopesWithStatus()` | Fetch only active (live) scopes |
| `useScopeStatusCounts()` | Get counts by status |
| `useHomePageScopes()` | Convenience hook for Home page |

---

## 5. Home Page Data Requirements

### Quick Stats Card
| Stat | Source Hook | Field |
|------|-------------|-------|
| Total Recordings | `useRecordingStats` | `totalRecordings` |
| Total Scopes | `useScopeStatusCounts` | `total` |
| Storage Used (GB) | `useRecordingStats` | `totalSizeBytes` (convert to GB) |

### Active Scopes Card
| Field | Source Hook | Field |
|-------|-------------|-------|
| Scopes list | `useHomePageScopes` | `scopes` |
| Scope name | `useHomePageScopes` | `scopes[].name` |
| Last activity | `useHomePageScopes` | `scopes[].lastActivityAt` |
| Status | `useHomePageScopes` | `scopes[].status` |

### Recordings Tab
| Feature | Hook | Description |
|---------|------|-------------|
| List recordings | `useRecordings` | With timeRange filter |
| Rename | `useRenameRecording` | On dropdown action |
| Pin | `usePinRecording` | On dropdown action |
| Delete | `useDeleteRecording` | On dropdown action |

### Scopes Tab
| Feature | Hook | Description |
|---------|------|-------------|
| List scopes | `useScopesWithStatus` | With status |
| Navigate to scope | React Router `Link` | `/scopes/:id` |

---

## 6. Missing Backend Requirements

The following backend resolvers/mutations need to be implemented:

### Queries to Implement
- [ ] `recordings(timeRange, scopeId, limit, offset, pinnedOnly)`
- [ ] `recording(id)`
- [ ] `recordingStats(timeRange)`
- [ ] `recentRecordings(limit)`
- [ ] `scopesWithStatus(limit, offset)`
- [ ] `activeScopesWithStatus`
- [ ] `scopeStatusCounts`

### Mutations to Implement
- [ ] `renameRecording(id, name)`
- [ ] `pinRecording(id, isPinned)`
- [ ] `deleteRecording(id)`
- [ ] `startRecording(scopeId, name)`
- [ ] `stopRecording(id)`
- [ ] `pauseRecording(id)`
- [ ] `resumeRecording(id)`
- [ ] `pinRecordings(ids, isPinned)`
- [ ] `deleteRecordings(ids)`

### Schema Additions
The `Recording` type needs to be added to the GraphQL schema:
```graphql
type Recording {
  id: ID!
  scopeId: ID!
  scopeName: String!
  name: String!
  timestamp: DateTime!
  durationMs: Int!
  sampleCount: Int!
  sizeBytes: Int!
  peakAmplitude: Float!
  rmsAmplitude: Float!
  isPinned: Boolean!
  isRecording: Boolean!
}

type ScopeWithStatus {
  id: ID!
  name: String!
  description: String
  status: ScopeStatus!
  sampleRate: Int!
  bufferSize: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
  lastActivityAt: DateTime!
  recordingCount: Int!
}

enum ScopeStatus {
  LIVE
  PAUSED
  OFFLINE
}
```

---

## 7. Files Created

```
packages/api-client/src/domain/recording/
├── types.ts      # Domain types
├── transforms.ts # Server → Domain transforms
└── index.ts      # Exports

apps/vyzorWeb/src/hooks/
├── use-recordings.ts        # Recording hooks
└── use-scopes-with-status.ts # Scope with status hooks
```

---

## 8. Next Steps

1. **Backend:** Implement schema types and resolvers
2. **API Client:** Update `packages/api-client/src/domain/index.ts` to export recording domain
3. **Hooks:** Update `apps/vyzorWeb/src/hooks/index.ts` to export new hooks
4. **UI:** Implement Home page components using the new hooks
