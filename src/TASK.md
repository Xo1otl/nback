# nback — TASK

## DONE — Domain (UI-agnostic)

- **`game`** — SSOT originator. Passive deterministic state machine + model + RNG + stimulus gen + config validation; no clock. Reducers emit append-only events → `SessionRecord` (`newSessionRecord`). Scoring vocab (`Outcome`, `matchAt`, `finalEngagedFrom`).
- **`driver`** — active runtime. Owns `Clock` + phase timers; threads `SessionState` through reducers in real time; accumulates events; publishes immutable `SessionSnapshot` (status/phase/trial/responses/feedback).
- **`analysis`** — projection. Read-only `SessionRecord` → `SessionScore` (per-mod SDT: d', criterion).

## DONE — UI (5 screens)

`App.tsx` = discriminated-union screen state machine (no router). `components/` `hooks/`
`storage/` populated. shadcn primitives vendored dependency-free in `components/ui/`.

1. **top** — `components/TopScreen.tsx`. Entry/menu.
2. **config** — `components/ConfigScreen.tsx`. Builds `SessionConfig` (N, mods, timing, seed)
   via `defaultMultiplexConfig` (filtered to selected mods) + `validateAndResolveConfig`.
3. **game** — `components/game/*`. Drives `driver` bound through `useSyncExternalStore`
   (`hooks/useSession.ts`). Pure projection of the snapshot: HUD + composite SVG Stage
   (position grid · shape · color · auto-contrast glyph · animation; audio via
   `speechSynthesis`, `hooks/useStimulusAudio.ts`) + per-mod ResponseRail. Sub-states
   ready → responding → feedback → done/aborted. Keyboard (one window listener), aria-live
   announcer, focus-trapped quit confirm, reduced-motion-aware (scored animation channel
   survives the global kill via `.stim-rm-keep`).
4. **analysis** — `components/AnalysisScreen.tsx`. Single-session `projectSessionScore`
   (per-mod H/M/F/C, d′, criterion). Minimal.
5. **history** — `components/HistoryScreen.tsx`. `storage` (localStorage) + d′ trend
   sparkline. Minimal.

Modality presentation: `lib/modalities.ts` (icons/labels/order) + `lib/modalityTheme.ts`
(stimulus colors, shapes, animation classes, outcome skins, key bindings, grid geometry).
