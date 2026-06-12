/**
 * In-memory test doubles for the persistence contract: a Store that holds
 * plain values (steps 2–3) and a KeyValue over a Map for exercising the real
 * localStorage-backed store in step 4.
 */

import type * as game from "@/game";
import type { KeyValue, SessionRecord, Store } from "./_contract";

export function newMemoryStore(): Store {
	let settings: game.Settings | undefined;
	let records: readonly SessionRecord[] = [];
	return {
		loadSettings: () => settings,
		saveSettings(next) {
			settings = next;
		},
		listRecords: () => records,
		addRecord(record) {
			records = [...records, record];
		},
		clearRecords() {
			records = [];
		},
	};
}

export type MemoryKeyValue = KeyValue & {
	/** Raw stored strings, for asserting serialization behavior. */
	readonly dump: () => ReadonlyMap<string, string>;
};

export function newMemoryKeyValue(): MemoryKeyValue {
	const map = new Map<string, string>();
	return {
		getItem: (key) => map.get(key) ?? null,
		setItem(key, value) {
			map.set(key, value);
		},
		removeItem(key) {
			map.delete(key);
		},
		dump: () => map,
	};
}
