// React bindings for driver runtime.
// useGameSession: one driver per mount; config validated eagerly → bad config = error, not thrown render.

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

// Driver constructed once per mount; caller starts clock on user gesture.
// HAZARD: only abort a *running* session on unmount; skipping idle/done/aborted keeps StrictMode mount→unmount→remount from aborting an unstarted session.
export function useGameSession(
	config: game.SessionConfig,
	options: GameSessionOptions,
	// Called when a still-running session is torn down on unmount; persists the aborted record.
	// INVARIANT: terminal session is not running → mutually exclusive with in-screen persist; no double-save.
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
