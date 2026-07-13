/**
 * Token search over `SessionRecord`. Whitespace-separated `key:value`, AND-combined.
 *   - modality keys (pos/color/char/shape/audio/anim): mentioned keys = EXACT
 *     enabled set (unmentioned ⇒ OFF), but only if ≥1 modality token present
 *     (scalar-only query leaves set unconstrained); value list ⇒ options ⊇ {…};
 *     `*` ⇒ enabled, any options. Cross-modal overlap via composition, e.g.
 *     `char:A audio:A`.
 *   - scalar keys — `n`, `time` (responding ms), `fb` (feedback ms), `match`
 *     (% rate), `played` (actual scored trials reached — {@link game.playedProblemCount}).
 *     Each `=`(default)/`>`/`>=`/`<`/`<=` + number, or `a..b`.
 *   - bool key — `done` (`y`/`n`): session ran to configured completion
 *     ({@link game.isComplete}), vs. ended early.
 */

import * as game from "@/game";

const MOD_KEYS: Record<string, game.ModID> = {
	pos: game.MOD_POSITION,
	color: game.MOD_COLOR,
	char: game.MOD_CHARACTER,
	shape: game.MOD_SHAPE,
	audio: game.MOD_AUDIO,
	anim: game.MOD_ANIMATION,
};
const KEY_FOR_MOD: Record<string, string> = Object.fromEntries(
	Object.entries(MOD_KEYS).map(([k, mod]) => [mod, k]),
);

type ScalarField = "n" | "time" | "fb" | "match" | "played";
const SCALAR_FIELDS: Record<string, ScalarField> = {
	n: "n",
	time: "time",
	fb: "fb",
	match: "match",
	played: "played",
};

type BoolField = "done";
const BOOL_FIELDS: Record<string, BoolField> = {
	done: "done",
};

type Op = "=" | ">" | ">=" | "<" | "<=";

export type Token =
	| { readonly kind: "mod"; readonly raw: string; readonly mod: game.ModID; readonly values: readonly string[] | null }
	| { readonly kind: "scalar"; readonly raw: string; readonly field: ScalarField; readonly op: Op; readonly value: number }
	| { readonly kind: "range"; readonly raw: string; readonly field: ScalarField; readonly lo: number; readonly hi: number }
	| { readonly kind: "bool"; readonly raw: string; readonly field: BoolField; readonly value: boolean }
	| { readonly kind: "error"; readonly raw: string; readonly message: string };

function parseToken(raw: string): Token {
	const idx = raw.indexOf(":");
	if (idx < 0) return { kind: "error", raw, message: "expected key:value" };
	const key = raw.slice(0, idx).toLowerCase();
	const val = raw.slice(idx + 1);

	const mod = MOD_KEYS[key];
	if (mod !== undefined) {
		if (val === "*") return { kind: "mod", raw, mod, values: null };
		const values = val
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		if (values.length === 0)
			return { kind: "error", raw, message: "no value (use * for any)" };
		return { kind: "mod", raw, mod, values };
	}

	const boolField = BOOL_FIELDS[key];
	if (boolField !== undefined) {
		if (val === "y") return { kind: "bool", raw, field: boolField, value: true };
		if (val === "n") return { kind: "bool", raw, field: boolField, value: false };
		return { kind: "error", raw, message: "expected y or n" };
	}

	const field = SCALAR_FIELDS[key];
	if (field !== undefined) {
		if (val.includes("..")) {
			const [a, b] = val.split("..");
			const lo = Number(a);
			const hi = Number(b);
			if (a === "" || b === "" || !Number.isFinite(lo) || !Number.isFinite(hi))
				return { kind: "error", raw, message: "bad range" };
			return { kind: "range", raw, field, lo, hi };
		}
		const m = /^(>=|<=|>|<|=)?(-?\d+(?:\.\d+)?)$/.exec(val);
		if (!m || m[2] === undefined)
			return { kind: "error", raw, message: "expected a number" };
		return { kind: "scalar", raw, field, op: (m[1] as Op) || "=", value: Number(m[2]) };
	}

	return { kind: "error", raw, message: `unknown key "${key}"` };
}

/** Invalid tokens kept, marked `error`. */
export function parseQuery(q: string): Token[] {
	const trimmed = q.trim();
	if (trimmed === "") return [];
	return trimmed.split(/\s+/).map(parseToken);
}

function scalarValue(record: game.SessionRecord, field: ScalarField): number {
	switch (field) {
		case "n":
			return record.spec.n;
		case "time":
			return record.spec.timing.respondingDuration;
		case "fb":
			return record.spec.timing.feedbackDuration;
		case "match":
			// whole-percent (query unit)
			return Math.round(record.spec.matchProbability * 100);
		case "played":
			return game.playedProblemCount(record);
	}
}

function boolValue(record: game.SessionRecord, field: BoolField): boolean {
	switch (field) {
		case "done":
			return game.isComplete(record);
	}
}

function cmp(v: number, op: Op, target: number): boolean {
	switch (op) {
		case "=":
			return v === target;
		case ">":
			return v > target;
		case ">=":
			return v >= target;
		case "<":
			return v < target;
		case "<=":
			return v <= target;
	}
}

function sameSet(a: readonly game.ModID[], b: readonly game.ModID[]): boolean {
	if (a.length !== b.length) return false;
	const set = new Set(a);
	return b.every((x) => set.has(x));
}

export function matchesQuery(record: game.SessionRecord, tokens: readonly Token[]): boolean {
	const spec = record.spec;
	const modTokens = tokens.filter(
		(t): t is Extract<Token, { kind: "mod" }> => t.kind === "mod",
	);
	if (modTokens.length > 0) {
		const want = [...new Set(modTokens.map((t) => t.mod))];
		if (!sameSet(spec.mods.map((m) => m.mod), want)) return false;
		for (const t of modTokens) {
			if (!t.values) continue;
			const opts = new Set(
				(game.specMod(spec, t.mod)?.options ?? []).map((o) => o.toLowerCase()),
			);
			if (!t.values.every((v) => opts.has(v.toLowerCase()))) return false;
		}
	}
	for (const t of tokens) {
		if (t.kind === "scalar") {
			if (!cmp(scalarValue(record, t.field), t.op, t.value)) return false;
		} else if (t.kind === "range") {
			const v = scalarValue(record, t.field);
			if (v < t.lo || v > t.hi) return false;
		} else if (t.kind === "bool") {
			if (boolValue(record, t.field) !== t.value) return false;
		}
	}
	return true;
}

/** Starter query: n + modality set as wildcards. */
export function defaultQuery(spec: game.SessionSpec): string {
	const mods = spec.mods.map((m) => `${KEY_FOR_MOD[m.mod] ?? m.mod}:*`);
	return [`n:${spec.n}`, ...mods].join(" ");
}

/** Exact session criteria as query string; pasteable into History search. */
export function queryForSpec(spec: game.SessionSpec): string {
	const parts = [`n:${spec.n}`];
	for (const m of spec.mods) {
		const key = KEY_FOR_MOD[m.mod] ?? m.mod;
		parts.push(m.options.length > 0 ? `${key}:${m.options.join(",")}` : `${key}:*`);
	}
	parts.push(`match:${Math.round(spec.matchProbability * 100)}`);
	parts.push(`time:${spec.timing.respondingDuration}`);
	parts.push(`fb:${spec.timing.feedbackDuration}`);
	return parts.join(" ");
}
