/**
 * Contract for the driver layer (§3 of src/game/specs.md) and its React
 * binding. The driver owns all timing: the game package never reads a clock.
 */

import type * as game from "@/game";

/** Injectable timer surface (structural subset of the global timer API). */
export interface Scheduler {
	setTimeout(fn: () => void, ms: number): unknown;
	clearTimeout(handle: unknown): void;
}

/** Speaks the audio-modality stimulus (§4: spoken letter readings). */
export interface Speaker {
	speak(option: game.AudioOption): void;
}

/**
 * Session driver (§3): emits closeTrial after each presentation interval and
 * nextTrial after each feedback duration, forwards player input immediately,
 * and speaks the audio stimulus at the start of every responding phase (for
 * sessions with the audio modality enabled).
 */
export interface Driver {
	/**
	 * Publish the initial snapshot and begin scheduling from responding(0).
	 * Calling start more than once is a no-op.
	 */
	start(): void;
	/** Cancel pending timers; the driver emits no further events. Idempotent. */
	stop(): void;
	/** Forward player input for the trial whose responding phase is active. */
	respond(modality: game.Modality): void;
}

export type DriverDeps = {
	readonly scheduler: Scheduler;
	/** Required when the session has the audio modality enabled. */
	readonly speaker?: Speaker;
	/** Called with a fresh snapshot after every event the driver dispatches. */
	readonly onChange: (snapshot: game.Snapshot) => void;
	/** Called exactly once, after onChange, when the session reaches done. */
	readonly onFinished?: (finalSnapshot: game.Snapshot) => void;
};

export type NewDriver = (session: game.Session, deps: DriverDeps) => Driver;

// ---- React binding ----

/** What a playing screen needs: the live state and the input handler. */
export type SessionController = {
	readonly snapshot: game.Snapshot;
	readonly respond: (modality: game.Modality) => void;
};

/**
 * Dependency injection for useSession. Every field has a production default
 * (real session factory, real driver, global timers, speech synthesis).
 */
export type UseSessionDeps = {
	readonly newSession?: game.NewSession;
	readonly newDriver?: NewDriver;
	readonly scheduler?: Scheduler;
	readonly speaker?: Speaker;
	readonly rng?: game.Rng;
	/** Replay support (§3); forwarded to the session factory. */
	readonly sequence?: readonly game.Stimulus[];
	readonly onFinished?: (finalSnapshot: game.Snapshot) => void;
};

/**
 * Runs one session per mount: constructs the session and driver once with
 * the settings/deps captured at mount, starts on mount, stops on unmount.
 * Throws SettingsError (via the session factory) for invalid settings.
 */
export type UseSession = (
	settings: game.Settings,
	deps?: UseSessionDeps,
) => SessionController;
