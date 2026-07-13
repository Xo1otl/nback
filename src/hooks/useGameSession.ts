import { useEffect, useRef, useSyncExternalStore } from "react";

import * as driver from "@/driver";
import * as game from "@/game";

export type GameSessionOptions = {
	readonly id: game.SessionID;
	readonly seed: game.RandomSeed;
};

/** ConfigError = sole expected failure; anything thrown is a bug and propagates. */
export type GameSession = {
	readonly driver: driver.SessionDriver | null;
	readonly error: game.ConfigError | null;
};

// HAZARD: only abort a *running* session on unmount; skipping idle/done/aborted keeps StrictMode mount→unmount→remount from aborting an unstarted session.
export function useGameSession(
	config: game.SessionConfig,
	options: GameSessionOptions,
	// INVARIANT: terminal session is not running → mutually exclusive with in-screen persist; no double-save.
	onAbandon?: (record: game.SessionRecord) => void,
): GameSession {
	const ref = useRef<GameSession | null>(null);
	if (ref.current === null) {
		const created = driver.createDriver(config, {
			id: options.id,
			seed: options.seed,
			deps: { clock: driver.browserClock() },
		});
		ref.current =
			created instanceof game.ConfigError
				? { driver: null, error: created }
				: { driver: created, error: null };
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

export function useDriverSnapshot(
	d: driver.SessionDriver,
): driver.SessionSnapshot {
	return useSyncExternalStore(d.subscribe, d.getSnapshot);
}
