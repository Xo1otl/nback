/**
 * Public surface of the `driver` package — the framework-agnostic session
 * runtime that drives the pure `game` state machine over real time.
 *
 * The domain (`game`) is a passive, deterministic state machine that never
 * reads the clock. The driver is the *active* side of that pairing: it owns the
 * clock and the phase timers, threads {@link game.SessionState} through the
 * reducers, accumulates the append-only event log, and publishes an immutable
 * {@link SessionSnapshot} to subscribers. It depends on `game` only (live
 * feedback is derived from state + stimuli, not from `analysis`).
 *
 * All side effects (clock, scheduling) are injected via {@link Clock}, so the
 * driver is deterministically testable with a fake clock and reusable in any
 * UI framework (bind with React's `useSyncExternalStore`, Svelte stores, etc.).
 */

import type * as game from "@/game";

export type SessionStatus = "idle" | "running" | "done" | "aborted";

/** Per-modality live judgment shown during feedback(t) on scored trials. */
export type ModFeedback = {
	readonly mod: game.ModID;
	/** stimulus[t] == stimulus[t-N] for this modality. */
	readonly match: boolean;
	/** Final accepted response state for this modality this trial. */
	readonly engaged: boolean;
	/** Whether the response was correct (match === engaged). */
	readonly correct: boolean;
};

/**
 * Immutable view of the session for the UI. A fresh value is published on every
 * state change; the reference is stable between changes (safe for
 * `useSyncExternalStore`).
 */
export type SessionSnapshot = {
	readonly status: SessionStatus;
	readonly phase: game.Phase;
	readonly trial: game.TrialIndex;
	readonly totalTrials: number;
	/** Whether the current trial is scored (t >= N) vs a memorization trial. */
	readonly scored: boolean;
	/** Current trial's stimulus; absent once done. */
	readonly stimulus: game.TrialStimulus | undefined;
	/** Live per-mod response toggle state for the current trial. */
	readonly responses: readonly game.ModResponse[];
	/** Per-mod judgments; present only during feedback(t) on a scored trial. */
	readonly feedback: readonly ModFeedback[] | undefined;
};

/**
 * Injected source of time and scheduling — the driver's only side-effect seam.
 * `now` is a monotonic clock in ms; `schedule` runs `fn` after `delayMs` and
 * returns a cancel function.
 */
export type Clock = {
	readonly now: () => game.Milliseconds;
	readonly schedule: (delayMs: game.Milliseconds, fn: () => void) => () => void;
};

export type DriverDeps = {
	readonly clock: Clock;
	/** Randomness for stimulus generation; defaults to `game.newRandomSource(seed)`. */
	readonly rng?: game.RandomSource;
};

export type DriverOptions = {
	readonly id: game.SessionID;
	readonly seed: game.RandomSeed;
	readonly deps: DriverDeps;
};

/**
 * A live session. Construction validates the config and pre-generates the
 * stimulus trace (so the first stimulus is renderable before `start`); the
 * clock does not run until {@link SessionDriver.start}.
 */
export interface SessionDriver {
	/** Current immutable snapshot (stable reference between changes). */
	getSnapshot(): SessionSnapshot;
	/** Subscribe to changes; returns an unsubscribe function. */
	subscribe(listener: () => void): () => void;
	/** Capture the origin, enter responding(0), and arm the phase timers. */
	start(): void;
	/** Log an engage response for `mod` at the current offset. */
	engage(mod: game.ModID): void;
	/** Log a disengage response for `mod` at the current offset. */
	disengage(mod: game.ModID): void;
	/** Stop the clock and end the session early. */
	abort(): void;
	/** The session record (events + stimuli); undefined before `start`. */
	record(): game.SessionRecord | undefined;
}
