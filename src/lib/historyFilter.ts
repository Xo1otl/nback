/**
 * `historyFilter` — composable filter ALGEBRA over stored sessions for the
 * History screen. Pure and React-free: the filter type, the match predicate,
 * and condition add/remove/enumerate. Adjacent concerns live with their owners:
 * display copy in `lib/conditionDisplay`, canonical modality ordering in
 * `lib/modalities`, and the match%↔probability conversion in `lib/sessionConfig`.
 *
 * A `SessionFilter` is a set of independent constraints on a session's config; a
 * session matches iff it agrees on every ACTIVE field (absent = wildcard).
 * Per-modality option-pool size is a first-class constraint because fewer
 * options ⇒ more cognitive interference ⇒ harder, so it is a real difficulty
 * axis and must be filterable, not folded away.
 */

import * as game from "@/game";
import { modsInOrder, sortedModIds } from "@/lib/modalities";
import { matchPctOf } from "@/lib/sessionConfig";

export type SessionFilter = {
	readonly n?: number;
	/** Exact active-modality set (canonical order). */
	readonly mods?: readonly game.ModID[];
	/** Required option-pool size per modality. */
	readonly options?: Readonly<Partial<Record<game.ModID, number>>>;
	readonly matchPct?: number;
	readonly respondingMs?: number;
	readonly feedbackMs?: number;
};

function sameSet(a: readonly game.ModID[], b: readonly game.ModID[]): boolean {
	if (a.length !== b.length) return false;
	const set = new Set(a);
	return b.every((x) => set.has(x));
}

/** Whether a session's config satisfies every active constraint in `f`. */
export function matchesFilter(spec: game.SessionSpec, f: SessionFilter): boolean {
	if (f.n != null && spec.n !== f.n) return false;
	if (f.mods && !sameSet(sortedModIds(spec), f.mods)) return false;
	if (f.options) {
		for (const mod of Object.keys(f.options)) {
			if (game.specMod(spec, mod)?.options.length !== f.options[mod]) return false;
		}
	}
	if (f.matchPct != null && matchPctOf(spec) !== f.matchPct) return false;
	if (f.respondingMs != null && spec.timing.respondingDuration !== f.respondingMs)
		return false;
	if (f.feedbackMs != null && spec.timing.feedbackDuration !== f.feedbackMs)
		return false;
	return true;
}

/**
 * The default filter: the latest session's stimulus configuration (N, exact
 * modality set, per-modality option counts) — so the graph opens on an
 * exact-difficulty trend of what you're currently training. Match rate and
 * timing are left unconstrained; add them explicitly to narrow further.
 */
export function defaultFilter(spec: game.SessionSpec): SessionFilter {
	return {
		n: spec.n,
		mods: sortedModIds(spec),
		options: Object.fromEntries(spec.mods.map((m) => [m.mod, m.options.length])),
	};
}

// ---- Conditions (the unit the UI adds/removes) -------------------------

/** One filterable constraint — the unit shown as a chip and offered in the
 * "add" menu. `kind` mirrors a `SessionFilter` field (options is per-modality). */
export type Condition =
	| { readonly kind: "n"; readonly n: number }
	| { readonly kind: "mods"; readonly mods: readonly game.ModID[] }
	| { readonly kind: "options"; readonly mod: game.ModID; readonly count: number }
	| { readonly kind: "matchPct"; readonly matchPct: number }
	| { readonly kind: "respondingMs"; readonly ms: number }
	| { readonly kind: "feedbackMs"; readonly ms: number };

export type ConditionKind = Condition["kind"];

/** Stable identity for dedup / React keys / active-set tests. */
export function conditionId(c: Condition): string {
	switch (c.kind) {
		case "n":
			return `n:${c.n}`;
		case "mods":
			return `mods:${c.mods.join(",")}`;
		case "options":
			return `opt:${c.mod}:${c.count}`;
		case "matchPct":
			return `match:${c.matchPct}`;
		case "respondingMs":
			return `resp:${c.ms}`;
		case "feedbackMs":
			return `fb:${c.ms}`;
	}
}

/** Apply a condition (replaces any existing constraint of the same dimension;
 * options accumulate per modality). */
export function withCondition(f: SessionFilter, c: Condition): SessionFilter {
	switch (c.kind) {
		case "n":
			return { ...f, n: c.n };
		case "mods":
			return { ...f, mods: c.mods };
		case "options":
			return { ...f, options: { ...f.options, [c.mod]: c.count } };
		case "matchPct":
			return { ...f, matchPct: c.matchPct };
		case "respondingMs":
			return { ...f, respondingMs: c.ms };
		case "feedbackMs":
			return { ...f, feedbackMs: c.ms };
	}
}

/** Remove a condition (rest-destructure to drop the readonly field cleanly). */
export function withoutCondition(f: SessionFilter, c: Condition): SessionFilter {
	switch (c.kind) {
		case "n": {
			const { n, ...rest } = f;
			return rest;
		}
		case "mods": {
			const { mods, ...rest } = f;
			return rest;
		}
		case "matchPct": {
			const { matchPct, ...rest } = f;
			return rest;
		}
		case "respondingMs": {
			const { respondingMs, ...rest } = f;
			return rest;
		}
		case "feedbackMs": {
			const { feedbackMs, ...rest } = f;
			return rest;
		}
		case "options": {
			if (!f.options) return f;
			const options = { ...f.options };
			delete options[c.mod];
			if (Object.keys(options).length === 0) {
				const { options: _drop, ...rest } = f;
				return rest;
			}
			return { ...f, options };
		}
	}
}

/** The active constraints, in canonical display order. */
export function activeConditions(f: SessionFilter): Condition[] {
	const out: Condition[] = [];
	if (f.n != null) out.push({ kind: "n", n: f.n });
	if (f.mods) out.push({ kind: "mods", mods: f.mods });
	if (f.options) {
		const opts = f.options;
		for (const mod of modsInOrder(Object.keys(opts))) {
			const count = opts[mod];
			if (count != null) out.push({ kind: "options", mod, count });
		}
	}
	if (f.matchPct != null) out.push({ kind: "matchPct", matchPct: f.matchPct });
	if (f.respondingMs != null)
		out.push({ kind: "respondingMs", ms: f.respondingMs });
	if (f.feedbackMs != null) out.push({ kind: "feedbackMs", ms: f.feedbackMs });
	return out;
}

/** Every distinct condition present across the given sessions — the universe
 * the "add filter" menu offers (so it never proposes an empty result). */
export function availableConditions(
	specs: readonly game.SessionSpec[],
): Condition[] {
	const byId = new Map<string, Condition>();
	const add = (c: Condition) => {
		const id = conditionId(c);
		if (!byId.has(id)) byId.set(id, c);
	};
	for (const spec of specs) {
		add({ kind: "n", n: spec.n });
		add({ kind: "mods", mods: sortedModIds(spec) });
		for (const m of spec.mods)
			add({ kind: "options", mod: m.mod, count: m.options.length });
		add({ kind: "matchPct", matchPct: matchPctOf(spec) });
		add({ kind: "respondingMs", ms: spec.timing.respondingDuration });
		add({ kind: "feedbackMs", ms: spec.timing.feedbackDuration });
	}
	return [...byId.values()];
}
