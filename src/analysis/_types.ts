/** INVARIANT: depends on `game`, never reverse. § → `./specs.md`. */

import type * as game from "@/game";

export type ModJudgment = {
	readonly mod: game.ModID;
	readonly outcome: game.Outcome;
};

export type TrialFeedback = {
	readonly trial: game.TrialIndex;
	readonly judgments: readonly ModJudgment[];
};

export type ModCounts = {
	readonly mod: game.ModID;
	/** hits */
	readonly h: number;
	/** misses */
	readonly m: number;
	/** false alarms */
	readonly f: number;
	/** correct rejects */
	readonly c: number;
};

/** H+M+F+C = problemCount when complete. §Scoring */
export function countsTotal(c: ModCounts): number {
	return c.h + c.m + c.f + c.c;
}

export type SDT = {
	/** d' = Z(HR) - Z(FAR). */
	readonly dPrime: number;
	/** c = -(Z(HR) + Z(FAR)) / 2. */
	readonly criterion: number;
};

export type ModScore = {
	readonly counts: ModCounts;
	/** absent when countsTotal = 0 — no observations, nothing to correct. */
	readonly sdt?: SDT;
};

export type SessionScore = {
	readonly mods: readonly ModScore[];
};

export function sessionScoreMod(
	score: SessionScore,
	id: game.ModID,
): ModScore | undefined {
	return score.mods.find((m) => m.counts.mod === id);
}

/** Z(p): inverse standard-normal CDF, p in (0,1). */
export type StandardNormalQuantile = (p: game.Probability) => number;
