import type * as game from "@/game";

export type SessionStatus = "idle" | "running" | "done" | "aborted";

export type ModFeedback = {
	readonly mod: game.ModID;
	/** SDT cell; match/engaged/correct derive via game.outcomeIs*. */
	readonly outcome: game.Outcome;
};

/** Immutable UI view; stable ref between changes (useSyncExternalStore-safe). */
export type SessionSnapshot = {
	readonly status: SessionStatus;
	readonly phase: game.Phase;
	readonly trial: game.TrialIndex;
	readonly totalTrials: number;
	/** scored iff t >= N (else memorization trial) */
	readonly scored: boolean;
	/** absent once done */
	readonly stimulus: game.TrialStimulus | undefined;
	readonly responses: readonly game.ModResponse[];
	/** present only during feedback(t) on scored trial */
	readonly feedback: readonly ModFeedback[] | undefined;
};

/** INVARIANT: `now` monotonic ms → offsets; `epochNow` wall-clock, stamped once into record.createdAt; `schedule` returns cancel. */
export type Clock = {
	readonly now: () => game.Milliseconds;
	readonly epochNow: () => game.Timestamp;
	readonly schedule: (delayMs: game.Milliseconds, fn: () => void) => () => void;
};

export type DriverDeps = {
	readonly clock: Clock;
	/** defaults to game.newRandomSource(seed) */
	readonly rng?: game.RandomSource;
};

export type DriverOptions = {
	readonly id: game.SessionID;
	readonly seed: game.RandomSeed;
	readonly deps: DriverDeps;
};

/** Clock idle until start(). */
export interface SessionDriver {
	getSnapshot(): SessionSnapshot;
	subscribe(listener: () => void): () => void;
	start(): void;
	engage(mod: game.ModID): void;
	disengage(mod: game.ModID): void;
	abort(): void;
	/** undefined before start() */
	record(): game.SessionRecord | undefined;
}
