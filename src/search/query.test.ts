import { describe, expect, test } from "bun:test";
import * as game from "@/game";
import * as search from "@/search";

const TIMING: game.TimingConfig = {
	respondingDuration: 2000,
	feedbackDuration: 500,
};

/** bare structural SessionSpec; only query-read fields matter */
function spec(
	n: number,
	mods: readonly { mod: game.ModID; opts: readonly string[] }[],
	over: Partial<game.SessionSpec> = {},
): game.SessionSpec {
	return {
		n,
		problemCount: 20,
		matchProbability: 0.3,
		timing: TIMING,
		mods: mods.map((m) => ({ mod: m.mod, options: m.opts })),
		...over,
	};
}

const match = (q: string, s: game.SessionSpec) =>
	search.matchesQuery(s, search.parseQuery(q));

describe("parseQuery", () => {
	test("flags malformed tokens but keeps valid ones", () => {
		const tokens = search.parseQuery("n:2 bogus:x color:* n:notnum");
		const kinds = tokens.map((t) => t.kind);
		expect(kinds).toEqual(["scalar", "error", "mod", "error"]);
	});

	test("empty query → no tokens", () => {
		expect(search.parseQuery("   ")).toEqual([]);
	});
});

describe("matchesQuery — modalities", () => {
	const colChar = spec(2, [
		{ mod: game.MOD_COLOR, opts: ["red", "green", "blue"] },
		{ mod: game.MOD_CHARACTER, opts: ["A", "B"] },
	]);

	test("mentioned keys pin the EXACT enabled set", () => {
		expect(match("color:* char:*", colChar)).toBe(true);
		expect(match("color:*", colChar)).toBe(false); // char not allowed
		expect(match("color:* char:* audio:*", colChar)).toBe(false); // audio absent
	});

	test("value list is contains-all (⊇), case-insensitive", () => {
		expect(match("color:red char:*", colChar)).toBe(true);
		expect(match("color:RED,green char:*", colChar)).toBe(true);
		expect(match("color:red,purple char:*", colChar)).toBe(false); // no purple
	});

	test("wildcard enables with no value constraint", () => {
		expect(match("color:* char:*", colChar)).toBe(true);
	});

	test("cross-modal overlap falls out of composition", () => {
		const both = spec(2, [
			{ mod: game.MOD_CHARACTER, opts: ["A", "B"] },
			{ mod: game.MOD_AUDIO, opts: ["A", "C"] },
		]);
		expect(match("char:A audio:A", both)).toBe(true); // both include A → overlap
		const disjoint = spec(2, [
			{ mod: game.MOD_CHARACTER, opts: ["A", "B"] },
			{ mod: game.MOD_AUDIO, opts: ["C", "D"] },
		]);
		expect(match("char:A audio:A", disjoint)).toBe(false);
	});
});

describe("matchesQuery — scalars", () => {
	const s = spec(3, [{ mod: game.MOD_COLOR, opts: ["red", "green"] }]); // match 30%, time 2000

	test("a scalar-only query leaves the modality set unconstrained", () => {
		expect(match("n:3", s)).toBe(true);
		expect(match("n:2", s)).toBe(false);
	});

	test("operators and ranges", () => {
		expect(match("n:>=3", s)).toBe(true);
		expect(match("n:>3", s)).toBe(false);
		expect(match("n:2..4", s)).toBe(true);
		expect(match("time:<2500", s)).toBe(true);
		expect(match("time:>2000", s)).toBe(false);
		expect(match("match:30", s)).toBe(true);
		expect(match("match:>40", s)).toBe(false);
	});

	test("empty-endpoint ranges are errors, not silent filters", () => {
		expect(search.parseQuery("n:..5")[0]?.kind).toBe("error");
		expect(search.parseQuery("n:5..")[0]?.kind).toBe("error");
		expect(match("n:5..", s)).toBe(true); // error ignored, not range [5,0] (never)
	});

	test("error tokens are ignored, valid ones still apply", () => {
		expect(match("n:3 bogus:x", s)).toBe(true);
		expect(match("n:2 bogus:x", s)).toBe(false);
	});
});

describe("defaultQuery", () => {
	test("produces a parseable query that matches its own spec", () => {
		const s = spec(2, [
			{ mod: game.MOD_POSITION, opts: ["r0c0", "r0c1"] },
			{ mod: game.MOD_COLOR, opts: ["red", "green"] },
		]);
		const q = search.defaultQuery(s);
		expect(q).toBe("n:2 pos:* color:*");
		expect(match(q, s)).toBe(true);
		expect(match(q, spec(2, [{ mod: game.MOD_COLOR, opts: ["red", "green"] }]))).toBe(
			false,
		);
	});
});

describe("queryForSpec", () => {
	test("emits exact criteria and round-trips against its own spec", () => {
		const s = spec(
			3,
			[
				{ mod: game.MOD_COLOR, opts: ["red", "green", "blue"] },
				{ mod: game.MOD_CHARACTER, opts: ["A", "B"] },
			],
			{ matchProbability: 0.3 },
		);
		const q = search.queryForSpec(s);
		expect(q).toContain("n:3");
		expect(q).toContain("color:red,green,blue");
		expect(q).toContain("char:A,B");
		expect(q).toContain("match:30");
		expect(q).toContain("time:2000");
		expect(q).toContain("fb:500");
		expect(match(q, s)).toBe(true);
	});
});
