/**
 * Token search over a session's `SessionSpec` — a small, UI-agnostic query
 * language for selecting/comparing past sessions by their configuration. Lives
 * in `analysis` (the read-side domain layer) rather than the UI: it is pure,
 * depends only on `game`, and is reusable from any front end. The UI owns only
 * the input box that feeds it a string.
 *
 * NOT a grammar/DSL: whitespace-separated `key:value` tokens, AND-combined.
 *   - modality option keys — `color:red,green`, `char:A,B`, `audio:A`, `pos:*`,
 *     `shape:square`, `anim:blur`. A modality is ENABLED iff its key appears;
 *     the mentioned keys define the EXACT enabled set (unmentioned ⇒ OFF), but
 *     only when ≥1 modality token is present (a scalar-only query leaves the set
 *     unconstrained). A value list means "options ⊇ {…}" (contains-all); `*`
 *     means "enabled, any options". Cross-modal interference is expressed by
 *     composition, e.g. `char:A audio:A` (both channels include A).
 *   - scalar keys — `n`, `time` (responding ms), `fb` (feedback ms), `match`
 *     (% rate). Each takes `=`(default)/`>`/`>=`/`<`/`<=` + a number, or `a..b`.
 */

import * as game from "@/game";

/** Short query key → modality id. */
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

type ScalarField = "n" | "time" | "fb" | "match";
const SCALAR_FIELDS: Record<string, ScalarField> = {
	n: "n",
	time: "time",
	fb: "fb",
	match: "match",
};

type Op = "=" | ">" | ">=" | "<" | "<=";

export type Token =
	| { readonly kind: "mod"; readonly raw: string; readonly mod: game.ModID; readonly values: readonly string[] | null }
	| { readonly kind: "scalar"; readonly raw: string; readonly field: ScalarField; readonly op: Op; readonly value: number }
	| { readonly kind: "range"; readonly raw: string; readonly field: ScalarField; readonly lo: number; readonly hi: number }
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

	const field = SCALAR_FIELDS[key];
	if (field !== undefined) {
		if (val.includes("..")) {
			const [a, b] = val.split("..");
			const lo = Number(a);
			const hi = Number(b);
			if (!Number.isFinite(lo) || !Number.isFinite(hi))
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

/** Parse a query string into tokens (invalid tokens are kept, marked `error`). */
export function parseQuery(q: string): Token[] {
	const trimmed = q.trim();
	if (trimmed === "") return [];
	return trimmed.split(/\s+/).map(parseToken);
}

function scalarValue(spec: game.SessionSpec, field: ScalarField): number {
	switch (field) {
		case "n":
			return spec.n;
		case "time":
			return spec.timing.respondingDuration;
		case "fb":
			return spec.timing.feedbackDuration;
		case "match":
			// Whole-percent match rate (the query's unit). Same trivial formula the
			// UI's `lib/sessionConfig.matchPctOf` uses for its own layer; not shared
			// across the layer boundary on purpose (analysis imports no UI lib).
			return Math.round(spec.matchProbability * 100);
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

/**
 * Whether a session's config satisfies all (non-error) tokens. Modality tokens,
 * if any, pin the EXACT enabled set (set comparison, so order-independent) and
 * each value list requires `options ⊇`; scalar/range tokens constrain
 * n/timing/match independently.
 */
export function matchesQuery(spec: game.SessionSpec, tokens: readonly Token[]): boolean {
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
			if (!cmp(scalarValue(spec, t.field), t.op, t.value)) return false;
		} else if (t.kind === "range") {
			const v = scalarValue(spec, t.field);
			if (v < t.lo || v > t.hi) return false;
		}
	}
	return true;
}

/** A starter query for a fresh install: the latest session's n + its modality
 * set (wildcards), so History opens on a comparable protocol; the user edits it.
 * `spec.mods` is already in canonical order (built that way), so no re-sort. */
export function defaultQuery(spec: game.SessionSpec): string {
	const mods = spec.mods.map((m) => `${KEY_FOR_MOD[m.mod] ?? m.mod}:*`);
	return [`n:${spec.n}`, ...mods].join(" ");
}

/** The EXACT criteria of a session as a query string — n, every enabled
 * modality with its full option set, match rate, and timing — so it can be
 * pasted into the History search to find/compare like sessions. Round-trips:
 * `matchesQuery(spec, parseQuery(queryForSpec(spec)))` is always true. */
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
