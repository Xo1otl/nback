# driver

Framework-agnostic session runtime that drives the pure `game` state machine over real time.

Not pure: it owns the clock and phase timers (the active side of the pure/passive pairing with `game`). Keep all side effects behind the injected `Clock` so the driver stays deterministically testable and UI-framework-agnostic. Depends on `game` only — live feedback is derived from session state + stimuli, never from `analysis`. Bind to UI via `useSyncExternalStore` (React), stores (Svelte), etc.

`createDriver` returns `SessionDriver | game.ConfigError` — invalid config is the expected failure, propagated from `game.startSession`, never thrown.
