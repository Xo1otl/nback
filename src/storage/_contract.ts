/**
 * Contract for persistence of settings and finished-session records.
 * Pure interfaces — implementations live in sibling internal files.
 */

import type * as game from "@/game";

/** The outcome of one completed session, as persisted for history views. */
export type SessionRecord = {
	/** Completion time, epoch milliseconds. */
	readonly finishedAt: number;
	readonly settings: game.Settings;
	readonly tallies: game.PerModality<game.Tally>;
	readonly kappas: game.PerModality<number>;
};

/**
 * Persistence boundary. Synchronous by design (backed by DOM Storage).
 * Absent or corrupt data reads as "nothing stored", never an error.
 */
export interface Store {
	loadSettings(): game.Settings | undefined;
	saveSettings(settings: game.Settings): void;
	/** All records, oldest first. */
	listRecords(): readonly SessionRecord[];
	addRecord(record: SessionRecord): void;
	clearRecords(): void;
}

/**
 * Minimal key-value backing (structural subset of DOM Storage) so the real
 * store is constructed over `window.localStorage` in the app and over an
 * in-memory map in tests.
 */
export interface KeyValue {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

/** Factory for the persistent store over an injected backing (§DI). */
export type NewLocalStore = (backing: KeyValue) => Store;
