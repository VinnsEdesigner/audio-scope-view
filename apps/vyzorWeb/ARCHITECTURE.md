# Audio Scope View - Frontend Architecture

> **Version:** 2.0  
> **Status:** Production Design  
> **Last Updated:** 2026-07-22  

---

## Architecture Overview

```
                            FRONTEND ARCHITECTURE

                         ┌─────────────────────┐
                         │      UI LAYER       │
                         │  (apps/vyzorWeb/)   │
                         │                     │
                         │  Pages, Components  │
                         │  ONLY renders UI.   │
                         │  Uses hooks.        │
                         │  NEVER imports Store│
                         │  or Domain.         │
                         └─────────────────────┘
                                    uses
                                    ↓
                         ┌─────────────────────┐
                         │  PRESENTATION LAYER │
                         │   (apps/vyzorWeb/)   │
                         │                     │
                         │  Custom hooks that: │
                         │  - Handle UI logic   │
                         │  - Transform data    │
                         │  - Read/write store  │
                         │  - NEVER renders UI. │
                         └─────────────────────┘
                                    uses
                         ┌─────────────┴─────────────┐
                         ↓                           ↓
┌─────────────────────────────┐       ┌─────────────────────────────┐
│      STORE LAYER           │       │      DOMAIN LAYER           │
│  (apps/vyzorWeb/src/store/)│       │  (packages/api-client/src/  │
│                            │       │          domain/)           │
│  Zustand stores:           │       │                             │
│  - UI state (sidebar,     │       │  Pure functions:            │
│    theme, modals)          │       │  - Types & interfaces       │
│  - Local preferences       │       │  - Transform data           │
│  - Real-time stream state  │       │  - Validate input           │
│                            │       │  NO side effects.           │
│  Hooks wrap stores.        │       └─────────────────────────────┘
└─────────────────────────────┘
                                    uses
                                    ↓
                         ┌─────────────────────────────┐
                         │        DATA LAYER          │
                         │ (packages/api-client/src/   │
                         │     audioScopeView/)        │
                         │                             │
                         │  API clients:               │
                         │  - GraphQL queries/mutations│
                         │  - WebSocket subscriptions  │
                         │  - Parse responses           │
                         └─────────────────────────────┘
```

---

## Dependency Rules

```
UI LAYER
  └─can use→ PRESENTATION LAYER (hooks)

PRESENTATION LAYER (hooks)
  └─can use→ STORE LAYER (zustand)
  └─can use→ DOMAIN LAYER
  └─can use→ DATA LAYER

STORE LAYER
  └─NO dependencies on other layers
  └─can use→ DOMAIN LAYER (for types)

DOMAIN LAYER
  └─NO dependencies on other layers

DATA LAYER
  └─can use→ DOMAIN LAYER
```

**Key Principle:** Dependencies flow inward only. Components → Hooks → Store/Domain/Data. Stores never import hooks, hooks never import components.

---

## Project Structure

```
audio-scope-view/
├── apps/
│   ├── vyzorWeb/                          # Web SPA application
│   │   ├── src/
│   │   │   ├── routes/                   # Route/page components (UI LAYER)
│   │   │   │   ├── _index.tsx           # Dashboard page
│   │   │   │   ├── scope.tsx            # Scope page
│   │   │   │   ├── scope_id.tsx         # Scope detail page
│   │   │   │   └── settings.tsx         # Settings page
│   │   │   │
│   │   │   ├── components/               # Shared UI components (UI LAYER)
│   │   │   │   ├── ui/                  # Base UI components (Tamagui)
│   │   │   │   │   ├── button.tsx
│   │   │   │   │   ├── input.tsx
│   │   │   │   │   ├── card.tsx
│   │   │   │   │   ├── slider.tsx
│   │   │   │   │   ├── switch.tsx
│   │   │   │   │   ├── text.tsx
│   │   │   │   │   ├── ystack.tsx
│   │   │   │   │   └── xstack.tsx
│   │   │   │   │
│   │   │   │   ├── layout/              # Layout components
│   │   │   │   │   ├── app-shell.tsx
│   │   │   │   │   ├── header.tsx
│   │   │   │   │   └── content-area.tsx
│   │   │   │   │
│   │   │   │   ├── scope/                # Scope-specific components
│   │   │   │   │   ├── waveform-display.tsx
│   │   │   │   │   ├── grid-overlay.tsx
│   │   │   │   │   ├── trigger-indicator.tsx
│   │   │   │   │   └── time-markers.tsx
│   │   │   │   │
│   │   │   │   ├── dashboard/            # Dashboard components
│   │   │   │   │   ├── summary-card.tsx
│   │   │   │   │   └── stats-grid.tsx
│   │   │   │   │
│   │   │   │   └── shared/               # Shared utility components
│   │   │   │       ├── loading-spinner.tsx
│   │   │   │       ├── error-boundary.tsx
│   │   │   │       └── empty-state.tsx
│   │   │   │
│   │   │   ├── hooks/                    # Custom hooks (PRESENTATION LAYER)
│   │   │   │   ├── use-dashboard-summary.ts
│   │   │   │   ├── use-scopes.ts
│   │   │   │   ├── use-scope-detail.ts
│   │   │   │   ├── use-waveform-stream.ts
│   │   │   │   ├── use-settings.ts
│   │   │   │   ├── use-audio-context.ts
│   │   │   │   └── use-media-devices.ts
│   │   │   │
│   │   │   ├── store/                    # Zustand stores (STATE LAYER)
│   │   │   │   ├── scope-store.ts
│   │   │   │   ├── settings-store.ts
│   │   │   │   ├── ui-store.ts
│   │   │   │   └── waveform-store.ts
│   │   │   │
│   │   │   ├── lib/                      # App utilities
│   │   │   │   ├── tamagui-config.ts
│   │   │   │   ├── theme-tokens.ts
│   │   │   │   └── constants.ts
│   │   │   │
│   │   │   ├── router.tsx               # React Router setup
│   │   │   ├── root.tsx                 # Root layout
│   │   │   ├── entry-client.tsx         # Client entry
│   │   │   └── entry-server.tsx         # Server entry (SSR)
│   │   │
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   │
│   └── vyzorMobile/                      # Mobile application (EXPO)
│       ├── app/
│       │   ├── routes/                   # Route/page components (UI LAYER)
│       │   │   ├── _index.tsx           # Dashboard
│       │   │   ├── scope.tsx            # Scope view
│       │   │   └── settings.tsx         # Settings
│       │   │
│       │   ├── components/               # Mobile-specific components
│       │   │   ├── ui/                  # Base UI components
│       │   │   ├── scope/               # Scope components
│       │   │   │   ├── mobile-waveform.tsx
│       │   │   │   └── mobile-controls.tsx
│       │   │   └── dashboard/           # Dashboard components
│       │   │
│       │   ├── hooks/                   # Mobile hooks (PRESENTATION LAYER)
│       │   │   ├── use-mobile-scope.ts
│       │   │   ├── use-mobile-audio.ts
│       │   │   └── use-mobile-settings.ts
│       │   │
│       │   └── store/                    # Zustand stores (STATE LAYER)
│       │       ├── scope-store.ts
│       │       └── settings-store.ts
│       │
│       ├── app.json
│       ├── package.json
│       ├── babel.config.js
│       └── metro.config.js
│
├── packages/
│   ├── api-client/                       # Shared API Client package
│   │   ├── src/
│   │   │   ├── domain/                  # DOMAIN LAYER
│   │   │   │   ├── _shared/            # Shared domain types
│   │   │   │   │   ├── types.ts
│   │   │   │   │   ├── transforms.ts
│   │   │   │   │   └── validation.ts
│   │   │   │   │
│   │   │   │   ├── scope/              # Scope domain
│   │   │   │   │   ├── types.ts
│   │   │   │   │   ├── transforms.ts
│   │   │   │   │   └── validation.ts
│   │   │   │   │
│   │   │   │   ├── settings/           # Settings domain
│   │   │   │   │   ├── types.ts
│   │   │   │   │   ├── transforms.ts
│   │   │   │   │   └── validation.ts
│   │   │   │   │
│   │   │   │   ├── waveform/           # Waveform domain
│   │   │   │   │   ├── types.ts
│   │   │   │   │   └── transforms.ts
│   │   │   │   │
│   │   │   │   └── dashboard/          # Dashboard domain
│   │   │   │       ├── types.ts
│   │   │   │       ├── transforms.ts
│   │   │   │       └── aggregation.ts
│   │   │   │
│   │   │   ├── audioScopeView/         # DATA LAYER
│   │   │   │   ├── graphql/            # GraphQL client & operations
│   │   │   │   │   ├── client.ts
│   │   │   │   │   ├── queries/
│   │   │   │   │   └── mutations/
│   │   │   │   ├── websocket/          # WebSocket client
│   │   │   │   │   └── client.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── index.ts
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui/                              # Shared UI components package
│   │   ├── src/
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   └── ...
│   │   └── package.json
│   │
│   ├── tamagui/                         # Tamagui theme config
│   │   ├── src/
│   │   │   └── tamagui.config.ts
│   │   └── package.json
│   │
│   └── config/                          # Shared configs
│       ├── eslint/
│       └── tsconfig/
│
└── docs/
    └── ARCHITECTURE.md                  # System architecture docs
```

---

## Zustand + Hooks Pattern (Option A)

Hooks wrap Zustand stores to provide a clean API to components.

### Step 1: Store Layer (Zustand)

```typescript
// apps/vyzorWeb/src/store/scope-store.ts
import { create } from 'zustand';
import type { Scope } from '@vyzorix/api-client/domain';

interface ScopeState {
  scopes: Scope[];
  isLoading: boolean;
  error: string | null;
}

interface ScopeActions {
  setScopes: (scopes: Scope[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearScopes: () => void;
}

type ScopeStore = ScopeState & ScopeActions;

export const useScopeStore = create<ScopeStore>((set) => ({
  scopes: [],
  isLoading: false,
  error: null,
  setScopes: (scopes) => set({ scopes, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearScopes: () => set({ scopes: [], error: null }),
}));
```

### Step 2: Presentation Layer (Hooks wrap stores)

```typescript
// apps/vyzorWeb/src/hooks/use-scopes.ts
import { useScopeStore } from '@/store/scope-store';
import { getScopes } from '@vyzorix/api-client/audioScopeView';

export function useScopes(options?: { limit?: number }) {
  const { scopes, isLoading, error, setScopes, setLoading, setError } = useScopeStore();

  const fetchScopes = async () => {
    setLoading(true);
    try {
      const data = await getScopes(options?.limit);
      setScopes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch scopes');
    }
  };

  return {
    scopes,
    isLoading,
    error,
    fetchScopes,
  };
}
```

### Step 3: UI Layer (Components use hooks only)

```typescript
// apps/vyzorWeb/src/routes/scope.tsx
import { useScopes } from '@/hooks/use-scopes';
import { ScopeCard } from '@/components/scope/scope-card';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { EmptyState } from '@/components/shared/empty-state';

export function ScopePage() {
  const { scopes, isLoading, error, fetchScopes } = useScopes({ limit: 10 });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <EmptyState title="Error loading scopes" description={error} />;
  }

  return (
    <div className="scope-grid">
      {scopes.map((scope) => (
        <ScopeCard key={scope.id} scope={scope} />
      ))}
    </div>
  );
}
```

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite (web), Expo (mobile) |
| UI Framework | Tamagui |
| GraphQL Client | graphql-request |
| Routing | TanStack Router |
| State Management | Zustand (local), TanStack Query (server) |
| Package Manager | pnpm |
| Monorepo | Turborepo |

---

## Audio Capture - Platform Abstraction

### Architecture Philosophy

**Server does NOT care about client platform.** All platform-specific audio capture logic lives on the client.

```
┌──────────────────────────────────────────────────────────────┐
│  CLIENT SIDE - Handles ALL platform-specific logic           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Browser (Web)  → navigator.mediaDevices.getUserMedia()       │
│                  Web Audio API                               │
│                                                              │
│  Mobile (Android/iOS) → expo-av Audio API                     │
│                         or native AudioRecord                 │
│                                                              │
│  ALL convert audio to standard format before sending         │
└──────────────────────────────────────────────────────────────┘
                              ↓
                   { samples: [f32], sampleRate, timestamp }
                              ↓
┌──────────────────────────────────────────────────────────────┐
│  SERVER SIDE - Platform-agnostic                             │
├──────────────────────────────────────────────────────────────┤
│  mutation submitAudio(scopeId, input) { success }            │
│                                                              │
│  Server just receives and processes audio data.               │
│  No User-Agent checking. No platform detection.              │
└──────────────────────────────────────────────────────────────┘
```

### Standard Audio Format

All clients MUST convert audio to this format before sending:

```typescript
interface AudioInput {
  samples: number[];      // f32 normalized to [-1.0, 1.0]
  sampleRate: number;      // Hz (e.g., 44100, 48000)
  timestampMs: number;    // Unix timestamp in milliseconds
  channels: number;       // 1 = mono, 2 = stereo
}
```

### Server GraphQL API

**Query: `audioInfo`**
```graphql
{
  audioInfo {
    supportedSampleRates  # [8000, 16000, 22050, 44100, 48000]
    maxSamplesPerSubmit   # 100000
    supportedChannels     # [1, 2]
  }
}
```

**Mutation: `submitAudio`**
```graphql
mutation SubmitAudio($scopeId: String!, $input: AudioInput!) {
  submitAudio(scopeId: $scopeId, input: $input) {
    success
    samplesReceived
  }
}
```

### Client Implementation Examples

#### Browser (Web Audio API)
```typescript
// apps/vyzorWeb/src/hooks/use-browser-audio.ts
import { useWaveformStore } from '@/store/waveform-store';
import { submitAudio } from '@vyzorix/api-client/audioScopeView';

export function useBrowserAudio(scopeId: string) {
  const { addSamples } = useWaveformStore();

  const startCapture = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const context = new AudioContext({ sampleRate: 44100 });
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = async (e) => {
      const samples = Array.from(e.inputBuffer.getChannelData(0));
      addSamples(samples);
      await submitAudio({
        scopeId,
        input: {
          samples,
          sampleRate: 44100,
          timestampMs: Date.now(),
          channels: 1,
        },
      });
    };
  };

  return { startCapture };
}
```

#### Mobile (Expo)
```typescript
// apps/vyzorMobile/app/hooks/use-mobile-audio.ts
import { Audio } from 'expo-av';

export function useMobileAudio(scopeId: string) {
  const startCapture = async () => {
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();

    recording.setOnRecordingStatusUpdate((status) => {
      if (status.isRecording && status.mediaStreaming) {
        // Convert to standard format and submit
      }
    });
  };

  return { startCapture };
}
```

### Hooks Structure

```
apps/vyzorWeb/src/hooks/
├── use-audio-capture.ts          # Unified hook (platform detection)
├── use-browser-audio.ts          # Web Audio API implementation
├── use-media-devices.ts          # Device enumeration
├── use-audio-context.ts          # Web Audio context management
└── use-audio-submit.ts           # GraphQL submission logic

apps/vyzorMobile/app/hooks/
├── use-mobile-audio.ts           # Expo AV implementation
├── use-mobile-devices.ts        # Mobile device selection
└── use-audio-submit.ts          # GraphQL submission logic
```

### Data Layer - Audio Submission

```typescript
// packages/api-client/src/audioScopeView/graphql/mutations/audio-mutations.ts

export const SUBMIT_AUDIO = gql`
  mutation SubmitAudio($scopeId: String!, $input: AudioInput!) {
    submitAudio(scopeId: $scopeId, input: $input) {
      success
      samplesReceived
    }
  }
`;

export const GET_AUDIO_INFO = gql`
  query GetAudioInfo {
    audioInfo {
      supportedSampleRates
      maxSamplesPerSubmit
      supportedChannels
    }
  }
`;
```

### Domain Layer - Audio Types

```typescript
// packages/api-client/src/domain/audio/types.ts

export interface AudioInput {
  samples: number[];      // f32 normalized [-1.0, 1.0]
  sampleRate: number;    // Hz
  timestampMs: number;   // Unix ms
  channels: number;      // 1 or 2
}

export interface AudioInfo {
  supportedSampleRates: number[];
  maxSamplesPerSubmit: number;
  supportedChannels: number[];
}

export interface AudioSubmitResult {
  success: boolean;
  samplesReceived: number;
}

export type Platform = 'browser' | 'mobile' | 'desktop';

export interface PlatformCapabilities {
  platform: Platform;
  supportedSampleRates: number[];
  maxBufferSize: number;
  supportsRealTime: boolean;
}
```

---

## Next Steps

1. Create `apps/vyzorWeb/src/store/` with Zustand stores
2. Refactor existing hooks to wrap stores (Option A)
3. Implement domain layer first (already done in api-client)
4. Implement data layer (already done in api-client)
5. Implement hooks (presentation layer) - use api-client
6. Implement components (UI layer)

---

## Recommended Packages

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@tanstack/react-router": "^1.22",
    "@tanstack/react-query": "^5.28",
    "@vyzorix/api-client": "workspace:*",
    "@vyzorix/ui": "workspace:*",
    "@vyzorix/tamagui": "workspace:*",
    "@tamagui/core": "^1.90",
    "@tamagui/vite": "^1.90",
    "zustand": "^4.5",
    "graphql": "^16.8",
    "graphql-request": "^6.1",
    "graphql-ws": "^5.14",
    "zod": "^3.22"
  }
}
```

---

*Document Version: 2.0*  
*Last Updated: 2026-07-22*
