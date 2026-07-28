# Scope Page Architecture

## Overview

The scope page (`/scope/:id`) serves as the unified view for both live audio capture and recording playback. It uses the same UI components for both modes, with mode-specific behavior handled through props and conditional rendering.

```
┌─────────────────────────────────────────────────────────┐
│                    Scope Page                            │
│                    /scope/:id                            │
│                                                         │
│  ┌─────┬───────────────────────────────────────────┐   │
│  │     │  <ScopeTopBar>                             │   │
│  │ 72px│  Title, Sample Rate, Mode-specific buttons │   │
│  │     ├───────────────────────────────────────────┤   │
│  │     │                                           │   │
│  │  S  │  <ScopeCanvas>                            │   │
│  │  I  │  Waveform display                        │   │
│  │  D  │  Grid overlay                            │   │
│  │  E  │  Mode-agnostic (same for both)           │   │
│  │  B  │                                           │   │
│  │  A  │                                           │   │
│  │  R  ├───────────────────────────────────────────┤   │
│  │     │  <ScopeBottomControls>                    │   │
│  │     │  Readouts, Sliders, Mode-specific UI    │   │
│  └─────┴───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Modes

### LIVE Mode
- **URL**: `/scope/:id`
- **Purpose**: Real-time audio capture from microphone
- **Data Source**: `useAudioAnalyzer` hook → microphone

### PLAYBACK Mode
- **URL**: `/scope/:id?recording=:recordingId`
- **Purpose**: View and analyze saved recordings
- **Data Source**: API → recording data

---

## Sidebar Structure

### LIVE Mode Sidebar (5 items)

| Item | Icon | Dialog/Action | Purpose |
|------|------|---------------|---------|
| Display | `BarChart3` | `display-settings-dialog.tsx` | Grid, Glow, Color, Auto-scale, Invert |
| Trigger | `Target` | `trigger-settings-dialog.tsx` | Edge (rising/falling/auto), Level |
| Measure | `Activity` | `measurements-dialog.tsx` | Vpp, RMS, Freq, DC offset readouts |
| Cal | `Maximize2` | Placeholder | Future calibration feature |
| Export | `Download` | `export-dialog.tsx` | Snapshot PNG, Export CSV |

### PLAYBACK Mode Sidebar (5 items)

| Item | Icon | Dialog/Action | Purpose |
|------|------|---------------|---------|
| Display | `BarChart3` | `display-settings-dialog.tsx` | Grid, Glow, Color, Auto-scale, Invert |
| Measure | `Activity` | `measurements-dialog.tsx` | Vpp, RMS, Freq, DC offset readouts |
| Info | `Info` | `RecordingInfoDialog` | Recording name, date, duration, size |
| Export | `Download` | `export-dialog.tsx` | Snapshot PNG, Export CSV |
| More | `MoreVertical` | Inline menu | Rename, Delete, Pin |

**Removed for playback**: Trigger, Cal (not applicable to recorded data)

---

## Component Structure

### Existing Components

| Component | File | LIVE | PLAYBACK | Notes |
|-----------|------|------|----------|-------|
| `ScopeSidebar` | `scope-sidebar.tsx` | ✅ | ✅ | Sidebar changes based on mode |
| `ScopeTopBar` | `scope-top-bar.tsx` | ✅ | ✅ | Buttons change based on mode |
| `ScopeCanvas` | `scope-canvas.tsx` | ✅ | ✅ | Mode-agnostic |
| `ScopeBottomControls` | `scope-bottom-controls.tsx` | ✅ | ✅ | Adds seek bar in playback |

### Existing Dialogs

| Dialog | File | LIVE | PLAYBACK |
|--------|------|------|----------|
| Display Settings | `display-settings-dialog.tsx` | ✅ | ✅ |
| Trigger Settings | `trigger-settings-dialog.tsx` | ✅ | ❌ |
| Measurements | `measurements-dialog.tsx` | ✅ | ✅ |
| Export | `export-dialog.tsx` | ✅ | ✅ |

### New Components Needed

| Component | File | Purpose |
|-----------|------|---------|
| `RecordingInfoDialog` | `recording-info-dialog.tsx` | Show recording metadata |
| `PlaybackControls` | Integrate into `ScopeBottomControls` | Play/Pause/Stop, Seek bar |

---

## Feature Matrix

| Feature | LIVE Mode | PLAYBACK Mode |
|---------|-----------|---------------|
| **Probe/Freeze** | ✅ Probe starts capture, Freeze pauses | ❌ |
| **Play/Pause** | ❌ | ✅ Play/Pause playback |
| **Seek Bar** | ❌ | ✅ Timeline scrubber |
| **Vpp/Freq/Win** | ✅ Real-time | ✅ From recording |
| **Timebase Slider** | ✅ | ⚠️ Read-only or disabled |
| **Vertical Gain** | ✅ | ⚠️ Read-only or disabled |
| **Trigger Settings** | ✅ Edge, Level | ❌ |
| **Export PNG/CSV** | ✅ | ✅ |
| **Rename Recording** | ❌ | ✅ |
| **Delete Recording** | ❌ | ✅ |
| **Pin Recording** | ❌ | ✅ |
| **Recording Info** | ❌ | ✅ Name, date, duration, size |

---

## Data Flow

### LIVE Mode

```
Microphone → useAudioAnalyzer → waveformData → ScopeCanvas
                                      ↓
                              measurements (vpp, freq)
                                      ↓
                              ScopeBottomControls
```

### PLAYBACK Mode

```
API → useRecording(recordingId) → recording.samples
                                      ↓
                              normalized waveformData
                                      ↓
                              ScopeCanvas
                                      ↓
                              measurements (vpp, freq)
                                      ↓
                              ScopeBottomControls
```

---

## Route Structure

```
/scope/:id                    → LIVE mode (default scope)
/scope/:id?recording=:rid     → PLAYBACK mode
```

### Navigation

```
Home Page
├── Recordings section → navigate('/scope/${scopeId}?recording=${recordingId}')
└── Scopes section    → navigate('/scope/${scopeId}')
```

---

## UI Store Additions

### Existing

```typescript
interface UIState {
  // ... existing
  showGrid: boolean;
  showMeasurements: boolean;
  smoothWaveform: boolean;
  waveformColor: WaveformColor;
  glow: boolean;
  autoScale: boolean;
  invert: boolean;
  triggerEdge: "rising" | "falling" | "auto";
  triggerLevel: number;
  timebase: number;
  verticalGain: number;
}
```

### Potential Additions

```typescript
interface UIState {
  // ... existing
  
  // Playback state (could be added)
  playbackSpeed: number;        // 0.5x, 1x, 2x
  loopPlayback: boolean;        // Loop recording
}
```

---

## Implementation Checklist

### Phase 1: Core Scope Page
- [ ] Create route `/scope/:id`
- [ ] Create `scope-page.tsx` component
- [ ] Add mode detection from URL
- [ ] Wire up LIVE mode with `useAudioAnalyzer`
- [ ] Wire up PLAYBACK mode with `useRecording`

### Phase 2: Component Updates
- [ ] Update `ScopeTopBar` with mode prop
- [ ] Update `ScopeSidebar` with mode-specific items
- [ ] Update `ScopeBottomControls` with seek bar (playback)
- [ ] Add mode prop to components or pass handlers from parent

### Phase 3: Dialogs
- [ ] Create `RecordingInfoDialog`
- [ ] Add playback-specific dialogs/menus
- [ ] Remove Trigger dialog from playback mode

### Phase 4: Playback Controls
- [ ] Create playback state management
- [ ] Add Play/Pause/Stop handlers
- [ ] Implement seek bar UI
- [ ] Add playback speed control

### Phase 5: Integration
- [ ] Update home page navigation
- [ ] Test LIVE ↔ PLAYBACK transitions
- [ ] Export functionality for both modes

---

## Component Props Reference

### ScopeTopBar

```typescript
interface Props {
  mode: "live" | "playback";
  scopeName?: string;
  recordingName?: string;  // playback only
  sampleRate?: number;
  onProbe?: () => void;    // live only
  onPlay?: () => void;     // playback only
  onPause?: () => void;    // playback only
  onFreeze?: () => void;   // live only
  isCapturing?: boolean;
  isPlaying?: boolean;     // playback
  isPaused?: boolean;      // playback
}
```

### ScopeCanvas

```typescript
interface Props {
  // No mode prop needed - mode agnostic
  waveformData: number[];
  isCapturing?: boolean;
  showGrid?: boolean;
  glow?: boolean;
  autoScale?: boolean;
  invert?: boolean;
  waveformColor?: WaveformColor;
  verticalGain?: number;
}
```

### ScopeBottomControls

```typescript
interface Props {
  mode: "live" | "playback";
  vpp: number;
  frequency: number;
  windowMs: number;
  timebase: number;
  verticalGain: number;
  onTimebaseChange?: (v: number) => void;  // live only
  onVerticalGainChange?: (v: number) => void;
  
  // Playback only
  duration?: number;
  currentTime?: number;
  onSeek?: (time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  playbackSpeed?: number;
  onSpeedChange?: (speed: number) => void;
}
```

### ScopeSidebar

```typescript
interface Props {
  mode: "live" | "playback";
  onDisplayClick?: () => void;
  onTriggerClick?: () => void;     // live only
  onMeasureClick?: () => void;
  onCalClick?: () => void;         // live only
  onExportClick?: () => void;
  onInfoClick?: () => void;         // playback only
  onRenameClick?: () => void;      // playback only
  onDeleteClick?: () => void;      // playback only
  onPinClick?: () => void;         // playback only
}
```

---

## Existing Hooks to Use

| Hook | Purpose |
|------|---------|
| `useAudioAnalyzer` | LIVE mode - mic capture, waveformData |
| `useRecording(id)` | PLAYBACK mode - load recording |
| `useUIStore` | Grid, glow, color settings |
| `useStartRecording` | Save recording (from mic) |
| `useStopRecording` | Stop recording |
| `useRenameRecording` | Rename (playback) |
| `useDeleteRecording` | Delete (playback) |
| `usePinRecording` | Pin (playback) |

---

## Notes

1. **Components stay reusable**: Same components work for both modes via props
2. **Shared canvas**: `ScopeCanvas` is completely mode-agnostic
3. **Dialog reuse**: Display, Measure, Export work for both modes
4. **Trigger removed in playback**: Not applicable to recorded data
5. **Settings persist**: UI store settings (grid, color, etc.) apply to both modes
