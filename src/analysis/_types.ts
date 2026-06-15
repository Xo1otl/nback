/**
 * Data model for analysis projections over a `game.SessionRecord`
 * (port of `contract-go/analysis`).
 *
 * Depends on `game`, never the reverse. Section references (§) point to
 * `contract-go/analysis/specs.md`.
 */

import type * as game from "@/game";

// ---- Outcomes (§Scoring) — the SDT confusion-matrix cells ----

export type Outcome = "H" | "M" | "F" | "C";
/** Hit: match + final state engaged. */
export const OUTCOME_HIT: Outcome = "H";
/** Miss: match + final state disengaged. */
export const OUTCOME_MISS: Outcome = "M";
/** False alarm: no match + final state engaged. */
export const OUTCOME_FALSE_ALARM: Outcome = "F";
/** Correct reject: no match + final state disengaged. */
export const OUTCOME_CORRECT_REJECT: Outcome = "C";

/** Whether the trial was a match (Hit or Miss). */
export function outcomeIsMatch(o: Outcome): boolean {
	return o === OUTCOME_HIT || o === OUTCOME_MISS;
}

/** Whether the final response state was engaged (Hit or FalseAlarm). */
export function outcomeIsEngaged(o: Outcome): boolean {
	return o === OUTCOME_HIT || o === OUTCOME_FALSE_ALARM;
}

/** Whether the response was correct (Hit or CorrectReject). */
export function outcomeIsCorrect(o: Outcome): boolean {
	return o === OUTCOME_HIT || o === OUTCOME_CORRECT_REJECT;
}

// ---- Per-trial projection ----

export type ModJudgment = {
	readonly mod: game.ModID;
	readonly outcome: Outcome;
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
