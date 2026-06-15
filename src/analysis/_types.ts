/**
 * Data model for analysis projections over a `game.SessionRecord`
 * (port of `contract-go/analysis`).
 *
 * Depends on `game`, never the reverse. Section references (§) point to
 * `contract-go/analysis/specs.md`.
 */

import type * as game from "@/game";

// ---- Per-trial projection ----
//
// The `Outcome` vocabulary (cells + `outcomeOf` + the predicates) lives in
// `game` now — it is the shared judgment used by both the live `driver`
// feedback and this projection — and is re-exported from this package's
// `index.ts` for convenience.

export type ModJudgment = {
	readonly mod: game.ModID;
	readonly outcome: game.Outcome;
};

export type TrialFeedback = {
	readonly trial: game.TrialIndex;
	readonly judgments: readonly ModJudgment[];
};

// ---- Per-mod aggregates & scores (§Scoring) ----

export type ModCounts = {
	readonly mod: game.ModID;
	/** Hits. */
	readonly h: number;
	/** Misses. */
	readonly m: number;
	/** False alarms. */
	readonly f: number;
	/** Correct rejects. */
	readonly c: number;
};

/** H + M + F + C = problemCount once the session is complete (§Scoring). */
export function countsTotal(c: ModCounts): number {
	return c.h + c.m + c.f + c.c;
}

/** Signal Detection Theory measures (§Scoring). */
export type SDT = {
	/** d' = Z(HR) - Z(FAR). */
	readonly dPrime: number;
	/** c = -(Z(HR) + Z(FAR)) / 2. */
	readonly criterion: number;
};

export type ModScore = {
	readonly counts: ModCounts;
	readonly sdt: SDT;
};

export type SessionScore = {
	readonly mods: readonly ModScore[];
};

/** Look up a modality's score, or `undefined` if absent. */
export function sessionScoreMod(
	score: SessionScore,
	id: game.ModID,
): ModScore | undefined {
	return score.mods.find((m) => m.counts.mod === id);
}

/** Inverse CDF of the standard normal distribution, Z(p) for p in (0, 1). */
export type StandardNormalQuantile = (p: game.Probability) => number;
