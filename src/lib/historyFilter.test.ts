import { describe, expect, test } from "bun:test";
import * as game from "@/game";
import * as hf from "@/lib/historyFilter";

const TIMING: game.TimingConfig = {
	respondingDuration: 2000,
	feedbackDuration: 500,
};

/** A bare structural SessionSpec; `over` tweaks individual fields. */
function spec(
	n: number,
	mods: readonly { mod: game.ModID; opts: number }[],
	over: Partial<game.SessionSpec> = {},
): game.SessionSpec {
	return {
		n,
		problemCount: 20,
		matchProbability: 0.3,
		timing: TIMING,
		mods: mods.map((m) => ({
			mod: m.mod,
			options: Array.from({ length: m.opts }, (_, i) => `o${i}`),
		})),
		...over,
	};
}

const COL3CHR4 = spec(2, [
	{ mod: game.MOD_COLOR, opts: 3 },
	{ mod: game.MOD_CHARACTER, opts: 4 },
]);

describe("matchesFilter", () => {
	test("empty filter matches everything", () => {
		expect(hf.matchesFilter(COL3CHR4, {})).toBe(true);
	});

	test("n constraint", () => {
		expect(hf.matchesFilter(COL3CHR4, { n: 2 })).toBe(true);
		expect(hf.matchesFilter(COL3CHR4, { n: 3 })).toBe(false);
	});

	test("mods constraint is exact and order-independent", () => {
		expect(
			hf.matchesFilter(COL3CHR4, {
				mods: [game.MOD_CHARACTER, game.MOD_COLOR],
			}),
		).toBe(true);
		// a superset session does NOT match an exact 2-mod constraint
		const three = spec(2, [
			{ mod: game.MOD_COLOR, opts: 3 },
			{ mod: game.MOD_CHARACTER, opts: 4 },
			{ mod: game.MOD_POSITION, opts: 9 },
		]);
		expect(
			hf.matchesFilter(three, { mods: [game.MOD_COLOR, game.MOD_CHARACTER] }),
		).toBe(false);
	});

	test("per-modality option-pool constraint", () => {
		expect(hf.matchesFilter(COL3CHR4, { options: { [game.MOD_COLOR]: 3 } })).toBe(
			true,
		);
		// same modalities, different option count → no match (the difficulty axis)
		expect(hf.matchesFilter(COL3CHR4, { options: { [game.MOD_COLOR]: 8 } })).toBe(
			false,
		);
		// a modality absent from the session can't satisfy an options constraint
		expect(
			hf.matchesFilter(COL3CHR4, { options: { [game.MOD_AUDIO]: 8 } }),
		).toBe(false);
	});

	test("match rate and timing constraints", () => {
		expect(hf.matchesFilter(COL3CHR4, { matchPct: 30 })).toBe(true);
		expect(hf.matchesFilter(COL3CHR4, { matchPct: 50 })).toBe(false);
		expect(hf.matchesFilter(COL3CHR4, { respondingMs: 2000 })).toBe(true);
		expect(hf.matchesFilter(COL3CHR4, { respondingMs: 1500 })).toBe(false);
	});

	test("constraints are conjunctive", () => {
		expect(
			hf.matchesFilter(COL3CHR4, {
				n: 2,
				options: { [game.MOD_COLOR]: 3 },
				matchPct: 30,
			}),
		).toBe(true);
		expect(
			hf.matchesFilter(COL3CHR4, { n: 2, matchPct: 99 }),
		).toBe(false);
	});
});

describe("defaultFilter", () => {
	test("captures the session's stimulus config, not match rate/timing", () => {
		const f = hf.defaultFilter(COL3CHR4);
		expect(f.n).toBe(2);
		expect(f.mods).toEqual([game.MOD_COLOR, game.MOD_CHARACTER]);
		expect(f.options).toEqual({
			[game.MOD_COLOR]: 3,
			[game.MOD_CHARACTER]: 4,
		});
		expect(f.matchPct).toBeUndefined();
		expect(f.respondingMs).toBeUndefined();
		// the latest session always matches its own default filter
		expect(hf.matchesFilter(COL3CHR4, f)).toBe(true);
	});
});

describe("conditions add/remove round-trip", () => {
	test("withCondition then withoutCondition restores the filter", () => {
		const base: hf.SessionFilter = { n: 2 };
		const added = hf.withCondition(base, {
			kind: "options",
			mod: game.MOD_COLOR,
			count: 3,
		});
		expect(added.options).toEqual({ [game.MOD_COLOR]: 3 });
		const removed = hf.withoutCondition(added, {
			kind: "options",
			mod: game.MOD_COLOR,
			count: 3,
		});
		expect(removed).toEqual({ n: 2 });
	});

	test("removing one of two option constraints keeps the other", () => {
		const f: hf.SessionFilter = {
			options: { [game.MOD_COLOR]: 3, [game.MOD_CHARACTER]: 4 },
		};
		const removed = hf.withoutCondition(f, {
			kind: "options",
			mod: game.MOD_COLOR,
			count: 3,
		});
		expect(removed.options).toEqual({ [game.MOD_CHARACTER]: 4 });
	});

	test("activeConditions enumerates every constraint in canonical order", () => {
		const f = hf.defaultFilter(COL3CHR4);
		const ids = hf.activeConditions(f).map(hf.conditionId);
		expect(ids).toEqual([
			"n:2",
			"mods:color,character",
			"opt:color:3",
			"opt:character:4",
		]);
	});
});

describe("availableConditions", () => {
	test("dedups across sessions and exposes every distinct value", () => {
		const a = spec(2, [{ mod: game.MOD_COLOR, opts: 3 }]);
		const b = spec(3, [{ mod: game.MOD_COLOR, opts: 8 }]);
		const ids = hf.availableConditions([a, b, a]).map(hf.conditionId);
		expect(ids).toContain("n:2");
		expect(ids).toContain("n:3");
		expect(ids).toContain("opt:color:3");
		expect(ids).toContain("opt:color:8");
		// "a" appears twice but contributes no duplicate ids
		expect(ids.filter((id) => id === "n:2")).toHaveLength(1);
	});
});
