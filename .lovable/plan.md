
# vyzorWeb UX Redesign

Keep the neutral (black / white / gray, browser-native `prefers-color-scheme`) palette we already have. No accent colors added. Redesign the app shell + every route so the UX matches the features that actually exist in the code (dashboard summary, scopes list, scope detail with live waveform, settings, API keys).

## 1. App shell (fix the broken sidebar)

`src/root.tsx` currently renders the literal string `"Sidebar"`. Replace with a real shell:

- New `components/layout/app-sidebar.tsx`: vertical nav with icon + label rows for Dashboard, Scopes, API Keys, Settings. Active row uses `--neutral` gray token, not accent. Collapsible on desktop (icon-only rail), full-height drawer on mobile triggered from a top bar hamburger.
- New `components/layout/top-bar.tsx`: 48px bar with hamburger (mobile), current page title, and a compact connection/status pill on the right when on a scope.
- Rewrite `AppShell` in `root.tsx` to compose `TopBar` + `AppSidebar` + `<Outlet />` in a CSS grid (`grid-template-columns: auto 1fr`). Use neutral tokens only.
- Delete the ad-hoc `.desktop-layout` / `.mobile-layout` CSS in `global.css`; move layout to the shell component.

## 2. Dashboard (`routes/_index.tsx`)

Current: 2x2 stats grid + linear list. Redesign:

- Compact greeting header ("Overview") with a subtle updated-timestamp.
- 4-up responsive stat row (1 col mobile, 2 col tablet, 4 col desktop) using a slimmer `SummaryCard` — remove decorative arrows, use small mono deltas.
- "Recent scopes" as a two-column layout on desktop: left = list of last 5 scopes with sparkline placeholder + status dot; right = a "Quick actions" card (Create scope, Open API keys, Open settings).
- Empty state gets an illustrated (icon only) card with a single primary action.

## 3. Scopes list (`routes/scope.tsx`)

Current: card-per-row list with inline status badge.
Redesign as a **data table + card grid toggle**:

- Header: title, description, right side = search input, view-toggle (list/grid), primary `+ New Scope` button.
- Default = table with columns: Name, Sample rate, Status (dot + label), Last updated, actions (open, delete). Row hover uses neutral gray.
- Grid view = 3-column card grid: name, meta line, status dot, mini "Open" button.
- Empty state: centered illustration + CTA; keep existing hook wiring.

## 4. Scope detail (`routes/scope-id.tsx`)

Current: waveform + stats row + long controls list stacked.
Redesign into a **workspace layout**:

- Sticky sub-header: back link, scope name, live status pill, primary actions (Start/Stop capture, Snapshot).
- Main: full-width `WaveformDisplay` in a bordered surface, aspect-ratio locked, with an overlay footer strip that shows Vpp / RMS / Frequency / Samples in a monospace grid (already have the data).
- Right rail (desktop) / accordion (mobile): grouped controls:
  - **Timebase** (Time scale slider + value)
  - **Vertical** (Voltage scale + invert switch)
  - **Trigger** (mode buttons Auto/Normal, level slider, edge direction)
  - **Display** (grid toggle, measurements toggle, smooth toggle, waveform color swatches — no ring border)
- Persistent bottom action row on mobile only.

## 5. Settings (`routes/settings.tsx`)

Reorganize into a sectioned settings page with a **left tab list** on desktop (Appearance / Audio / Display / About) and stacked sections on mobile:

- Appearance: theme trio (Light/Moon/System) using segmented control style, waveform color swatches (borderless).
- Audio: input device selector as a proper radio list, permission status inline chip.
- Display: switch rows for grid / measurements / smooth.
- About: version, links.
- Replace the inline `<button>` elements with the shared `Button` primitive + tamagui styled wrappers for consistency.

## 6. API keys (`routes/api-keys.tsx` + `components/api-keys/*`)

- Page header: title + description + primary `+ Create API key`.
- List view: table on desktop (Name, Key preview, Rate limit, Created, Expires, Status, actions), stacked cards on mobile.
- Keep existing dialogs (`ApiKeyForm`, `ApiKeyCreatedDialog`), restyle their surfaces to neutral tokens (drop `$red1/$red11` error surface — use neutral border + destructive text token).
- `ApiKeyCard` becomes the mobile card renderer with copy button, edit, delete (destructive ghost).

## 7. Tokens & styling rules

- All colors sourced from tamagui neutrals (`$gray1..$gray12`) + system `Canvas`/`CanvasText` where needed. No `#hex` colors in TSX except the 3 waveform trace colors (blue / red / teal) which are data, not chrome.
- Remove the `oklch(...)` and hard-coded `#22c55e` badge colors in `scope.tsx` — use `$gray*` + a subtle dot.
- Border radii: `$md` for controls, `$lg` for surfaces. Spacing scale via `$xs/$sm/$md/$lg` only.
- Every interactive element gets a hover + focus-visible outline using neutral tokens.

## 8. What I will NOT touch

- Hooks, stores, `api-client` package, `WaveformDisplay` canvas rendering internals, rust server.
- Route paths / router structure (`src/router.tsx` stays as-is).
- Existing dialogs' business logic.

## Technical notes

- Use existing `styled(...)` tamagui pattern to stay consistent with the codebase; do NOT introduce a new styling system.
- Import `Sidebar`, `Card`, `Button`, `Switch`, `Slider` from `@audio-scope-view/ui` where already used. Add `Table`, `Tabs`, `Input` imports from the same package.
- Use `lucide-react` icons already present.
- Keep files under `src/components/{layout,dashboard,scope,api-keys}/` — add `layout/app-sidebar.tsx`, `layout/top-bar.tsx`. New table variants live inline in their route file to avoid over-abstraction.
- Verify with the running preview (Playwright screenshots at mobile 544px and desktop 1280px) in both light and dark browser themes.

## Order of execution

1. Shell (root.tsx, app-sidebar, top-bar, kill global.css layout rules)
2. Dashboard
3. Scopes list
4. Scope detail
5. Settings
6. API keys
7. Screenshot verification pass
