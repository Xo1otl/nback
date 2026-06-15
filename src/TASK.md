# nback — TASK

## DONE — Domain (UI-agnostic)

- **`game`** — SSOT originator. Passive deterministic state machine + model + RNG + stimulus gen + config validation; no clock. Reducers emit append-only events → `SessionRecord` (`newSessionRecord`). Scoring vocab (`Outcome`, `matchAt`, `finalEngagedFrom`).
- **`driver`** — active runtime. Owns `Clock` + phase timers; threads `SessionState` through reducers in real time; accumulates events; publishes immutable `SessionSnapshot` (status/phase/trial/responses/feedback).
- **`analysis`** — projection. Read-only `SessionRecord` → `SessionScore` (per-mod SDT: d', criterion).

## TODO — UI (5 screens)

Not started: `App.tsx` boilerplate; `components/` `hooks/` `storage/` empty;

1. **top** — entry/menu.
2. **config** — build `SessionConfig` (N, mods, timing, seed) via `validateAndResolveConfig` / `defaultMultiplexConfig`.
3. **game** — drive via `driver`. Sub-states: ready → responding → feedback (`PHASE_FEEDBACK`) → done (`status==="done"`).
4. **analysis** — single-session `projectSessionScore`.
5. **history** — past sessions + d' trend.
