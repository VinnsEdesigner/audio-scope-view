# VyzorMobile - Mobile Application Architecture

> **Version:** 1.0  
> **Status:** Draft  
> **Last Updated:** 2026-07-22  

---

## Overview

This document covers the mobile-specific architecture. For shared architecture patterns, hooks structure, and data layer details, see [apps/vyzorWeb/ARCHITECTURE.md](../vyzorWeb/ARCHITECTURE.md).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      MOBILE ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────┘

                         ┌─────────────────────┐
                         │      UI LAYER       │
                         │  (apps/vyzorMobile/  │
                         │       app/)          │
                         │                     │
                         │  Screens, Components│
                         │  ONLY renders UI.   │
                         │  Uses hooks.        │
                         └─────────────────────┘
                                    uses
                                    ↓
                         ┌─────────────────────┐
                         │  PRESENTATION LAYER │
                         │ (apps/vyzorMobile/   │
                         │    app/hooks/)       │
                         │                     │
                         │  Custom hooks that: │
                         │  - Handle UI logic   │
                         │  - Access stores    │
                         │  - NEVER renders UI. │
                         └─────────────────────┘
                                    uses
                         ┌─────────────┴─────────────┐
                         ↓                           ↓
┌─────────────────────────────┐       ┌─────────────────────────────┐
│      STORE LAYER           │       │      DOMAIN LAYER           │
│ (apps/vyzorMobile/app/store/)│     │  (packages/api-client/src/  │
│                            │       │        domain/)             │
│  Zustand stores:           │       │                             │
│  - Mobile UI state        │       │  Shared across web & mobile │
│  - Audio capture state    │       │  - Types & interfaces      │
│  - Local preferences      │       │  - Transform data           │
│                            │       └─────────────────────────────┘
└─────────────────────────────┘
                                    uses
                                    ↓
                         ┌─────────────────────────────┐
                         │        DATA LAYER          │
                         │ (packages/api-client/src/   │
                         │     audioScopeView/)        │
                         └─────────────────────────────┘
```

---

## Project Structure

```
apps/vyzorMobile/
├── app/                                # Expo Router app directory
│   ├── routes/                         # Route/page components (UI LAYER)
│   │   ├── _index.tsx                # Dashboard screen
│   │   ├── scope.tsx                 # Scope view screen
│   │   └── settings.tsx              # Settings screen
│   │
│   ├── components/                    # Mobile-specific components (UI LAYER)
│   │   ├── ui/                      # Base UI components (Tamagui)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   └── ...
│   │   │
│   │   ├── scope/                   # Scope-specific components
│   │   │   ├── mobile-waveform.tsx
│   │   │   ├── mobile-grid.tsx
│   │   │   └── mobile-controls.tsx
│   │   │
│   │   └── dashboard/               # Dashboard components
│   │       └── mobile-stats.tsx
│   │
│   ├── hooks/                        # Custom hooks (PRESENTATION LAYER)
│   │   │   ├── use-mobile-scope.ts
│   │   │   ├── use-mobile-audio.ts
│   │   │   ├── use-mobile-settings.ts
│   │   │   ├── use-media-devices.ts
│   │   │   └── use-waveform-stream.ts
│   │
│   ├── store/                        # Zustand stores (STATE LAYER)
│   │   │   ├── scope-store.ts
│   │   │   ├── settings-store.ts
│   │   │   └── ui-store.ts
│   │
│   ├── _layout.tsx                  # Root layout (Expo Router)
│   └── index.tsx                    # Entry point
│
├── app.json                          # Expo configuration
├── babel.config.js                   # Babel config
├── metro.config.js                   # Metro bundler config
├── eas.json                          # EAS Build config
├── package.json
└── tsconfig.json
```

---

## Dependency Rules

```
UI LAYER (screens, components)
  └─can use→ PRESENTATION LAYER (hooks)

PRESENTATION LAYER (hooks)
  └─can use→ STORE LAYER (zustand)
  └─can use→ DOMAIN LAYER (from api-client)
  └─can use→ DATA LAYER (from api-client)

STORE LAYER
  └─NO dependencies on other layers
  └─can use→ DOMAIN LAYER (for types)

DOMAIN LAYER (packages/api-client)
  └─NO dependencies on other layers

DATA LAYER (packages/api-client)
  └─can use→ DOMAIN LAYER
```

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React Native + Expo |
| Build Tool | Expo (Metro) |
| UI Framework | Tamagui |
| Routing | Expo Router |
| State Management | Zustand (local), TanStack Query (server) |
| Audio | expo-av |
| Package Manager | pnpm |

---

## Mobile-Specific Considerations

### Audio Capture (expo-av)

```typescript
// apps/vyzorMobile/app/hooks/use-mobile-audio.ts
import { Audio } from 'expo-av';
import { useWaveformStore } from '../store/waveform-store';
import { submitAudio } from '@vyzorix/api-client/audioScopeView';

export function useMobileAudio(scopeId: string) {
  const { addSamples } = useWaveformStore();

  const startCapture = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    await recording.startAsync();

    recording.setOnRecordingStatusUpdate((status) => {
      if (status.isRecording && status.mediaStreaming) {
        // Process and submit audio
      }
    });
  };

  return { startCapture };
}
```

### Platform Detection

Mobile-specific hooks should detect the platform and provide appropriate implementations.

---

## Next Steps

1. Set up Zustand stores in `app/store/`
2. Create mobile-specific hooks in `app/hooks/`
3. Implement UI components in `app/components/`
4. Create screens in `app/routes/`

---

*Document Version: 1.0*  
*Last Updated: 2026-07-22*
