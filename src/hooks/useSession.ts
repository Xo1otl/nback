/**
 * React bindings for the `driver` runtime.
 *
 * `useGameSession` owns one {@link driver.SessionDriver} per mount (created once,
 * config validated eagerly so a bad config surfaces as an error rather than a
 * thrown render), and stops it when the screen really goes away.
 *
 * `useDriverSnapshot` is the `useSyncExternalStore` binding to the driver's
 * immutable snapshot — the driver publishes a fresh value on every change and
 * keeps the reference stable in between, exactly what the store contract wants.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";

import * as driver from "@/driver";
import type * as game from "@/game";

export type GameSessionOptions = {
	readonly id: game.SessionID;
	readonly seed: game.RandomSeed;
};

export type GameSession = {
	/** The live driver, or `null` if the config failed validation. */
	readonly driver: driver.SessionDriver | null;
	/** The `ConfigError` (or other) thrown at construction, if any. */
	readonly error: Error | null;
};

type Cell = { driver: driver.SessionDriver | null; error: Error | null };

/**
 * Construct a driver for `config` exactly once for the lifetime of the mount.
 * Construction validates the config and pre-generates the stimulus trace but
 * does NOT start the clock — the caller starts on a user gesture. On a genuine
 * unmount we abort a *running* session to release its timers; we deliberately
 * skip aborting an `idle`/`done`/`aborted` driver so React StrictMode's
 * dev-only mount→unmount→remount cycle (which fires before any `start`) can't
 * abort a session the user has not begun.
 */
export function useGameSession(
	config: game.SessionConfig,
	options: GameSessionOptions,
	/**
	 * Called if a still-`running` session is torn down on unmount, with the
	 * record captured right after the safety abort — so an abandoned run is
	 * persisted rather than silently lost. The in-screen terminal persist and
	 * this path are mutually exclusive (a terminal session is not `running`),
	 * so there is no double-save.
	 */
	onAbandon?: (record: game.SessionRecord) => void,
): GameSession {
	const ref = useRef<Cell | null>(null);
	if (ref.current === null) {
		try {
			ref.current = {
				driver: driver.createDriver(config, {
					id: options.id,
					seed: options.seed,
					deps: { clock: driver.browserClock() },
				}),
				error: null,
			};
		} catch (err) {
			ref.current = { driver: null, error: err as Error };
		}
	}

	const cell = ref.current;
	const abandonRef = useRef(onAbandon);
	abandonRef.current = onAbandon;
	useEffect(() => {
		const d = cell.driver;
		if (!d) return;
		return () => {
			if (d.getSnapshot().status === "running") {
				d.abort();
				const record = d.record();
				if (record) abandonRef.current?.(record);
			}
		};
	}, [cell.driver]);

	return cell;
}

/** Subscribe to a driver's immutable snapshot (stable between changes). */
export function useDriverSnapshot(
	d: driver.SessionDriver,
): driver.SessionSnapshot {
	return useSyncExternalStore(d.subscribe, d.getSnapshot);
}
