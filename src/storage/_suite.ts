/**
 * Reusable contract suite for the Store interface (_contract.ts).
 * Parameterized over a factory so every implementation — the in-memory mock
 * now, the localStorage-backed store later (step 4) — is held to the same
 * expectations. Every test calls the factory for a fresh store.
 */

import { describe, expect, test } from "bun:test";
import type * as game from "@/game";
import type { SessionRecord, Store } from "./_contract";

/** Full valid settings (§6) with position enabled, hence a grid. */
function makeSettings(): game.Settings {
	return {
		n: 2,
		problemCount: 8,
		modalities: ["position", "color"],
		grid: { rows: 3, cols: 3 },
		minMatchProbability: 0.25,
		presentationMs: 2000,
		feedbackMs: 500,
	};
}

/** A second valid settings value (no position, so no grid) for overwrites. */
function makeAltSettings(): game.Settings {
	return {
		n: 3,
		problemCount: 20,
		modalities: ["letter", "audio", "shape"],
		minMatchProbability: 0.125,
		presentationMs: 2500,
		feedbackMs: 0,
	};
}

/** A realistic finished-session record; tallies sum to problemCount (§7). */
function makeRecord(finishedAt: number): SessionRecord {
	return {
		finishedAt,
		settings: makeSettings(),
		tallies: {
			position: { hit: 3, miss: 1, falseAlarm: 1, correctRejection: 3 },
			color: { hit: 2, miss: 2, falseAlarm: 0, correctRejection: 4 },
		},
		kappas: { position: 0.625, color: -0.2 },
	};
}

export function runStoreContractSuite(label: string, make: () => Store): void {
	describe(label, () => {
		describe("settings", () => {
			test("loadSettings on a fresh store returns undefined", () => {
				const store = make();
				expect(store.loadSettings()).toBeUndefined();
			});

			test("saveSettings then loadSettings roundtrips deep-equal", () => {
				const store = make();
				const settings = makeSettings();
				store.saveSettings(settings);
				expect(store.loadSettings()).toEqual(settings);
			});

			test("saving again overwrites the previous settings", () => {
				const store = make();
				store.saveSettings(makeSettings());
				const next = makeAltSettings();
				store.saveSettings(next);
				expect(store.loadSettings()).toEqual(next);
			});
		});

		describe("records", () => {
			test("listRecords on a fresh store returns an empty array", () => {
				const store = make();
				expect(store.listRecords()).toEqual([]);
			});

			test("addRecord then listRecords roundtrips the record deep-equal", () => {
				const store = make();
				const record = makeRecord(1_760_000_000_000);
				store.addRecord(record);
				expect([...store.listRecords()]).toEqual([record]);
			});

			test("multiple addRecord calls list oldest first, in stable order", () => {
				const store = make();
				const a = makeRecord(1_760_000_000_000);
				const b = makeRecord(1_760_000_060_000);
				const c = makeRecord(1_760_000_120_000);
				store.addRecord(a);
				store.addRecord(b);
				store.addRecord(c);
				expect([...store.listRecords()]).toEqual([a, b, c]);
				// A second call yields the same order again.
				expect([...store.listRecords()]).toEqual([a, b, c]);
			});

			test("clearRecords empties the list", () => {
				const store = make();
				store.addRecord(makeRecord(1_760_000_000_000));
				store.addRecord(makeRecord(1_760_000_060_000));
				store.clearRecords();
				expect(store.listRecords()).toEqual([]);
			});

			test("listRecords reflects state at call time; a new call sees later additions", () => {
				const store = make();
				const first = makeRecord(1_760_000_000_000);
				store.addRecord(first);
				const before = store.listRecords();
				expect([...before]).toEqual([first]);
				const second = makeRecord(1_760_000_060_000);
				store.addRecord(second);
				// The earlier array still describes the state when it was returned...
				expect(before).toHaveLength(1);
				// ...while a fresh call returns the longer list.
				expect([...store.listRecords()]).toEqual([first, second]);
			});
		});

		describe("independence of settings and records", () => {
			test("records survive interleaved saveSettings calls", () => {
				const store = make();
				const a = makeRecord(1_760_000_000_000);
				const b = makeRecord(1_760_000_060_000);
				store.saveSettings(makeSettings());
				store.addRecord(a);
				store.saveSettings(makeAltSettings());
				store.addRecord(b);
				expect([...store.listRecords()]).toEqual([a, b]);
				expect(store.loadSettings()).toEqual(makeAltSettings());
			});

			test("clearRecords leaves settings intact", () => {
				const store = make();
				const settings = makeSettings();
				store.saveSettings(settings);
				store.addRecord(makeRecord(1_760_000_000_000));
				store.clearRecords();
				expect(store.listRecords()).toEqual([]);
				expect(store.loadSettings()).toEqual(settings);
			});
		});
	});
}
