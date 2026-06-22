/** Public surface of the `driver` package. */

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
	/** The SDT confusion-matrix cell (Hit/Miss/FalseAlarm/CorrectReject). */
	readonly outcome: game.Outcome;
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
 * Injected time/scheduling seam. INVARIANT: `now` monotonic ms → offsets;
 * `epochNow` wall-clock, stamped once into record.createdAt; `schedule` returns cancel.
 */
export type Clock = {
	readonly now: () => game.Milliseconds;
	readonly epochNow: () => game.Timestamp;
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

/** A live session. Clock idle until {@link SessionDriver.start}. */
export interface SessionDriver {
	/** Current immutable snapshot (stable reference between changes). */
	getSnapshot(): SessionSnapshot;
	/** Subscribe to changes; returns an unsubscribe function. */
	subscribe(listener: () => void): () => void;
	/** Stamp the start time, enter responding(0), and arm the phase timers. */
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
