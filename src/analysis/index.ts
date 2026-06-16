/**
 * `analysis` — pure projections over a `game.SessionRecord`.
 *
 * Port of `contract-go/analysis`. Depends on `game`, never the reverse.
 * Import as a namespace: `import * as analysis from "@/analysis"`.
 */

// ---- Outcome vocabulary (defined in `game`; re-exported here for convenience) ----
export {
	type Outcome,
	OUTCOME_HIT,
	OUTCOME_MISS,
	OUTCOME_FALSE_ALARM,
	OUTCOME_CORRECT_REJECT,
	outcomeIsMatch,
	outcomeIsEngaged,
	outcomeIsCorrect,
} from "@/game";

// ---- Data model: judgments, counts, scores ----
export {
	type ModJudgment,
	type TrialFeedback,
	type ModCounts,
	countsTotal,
	type SDT,
	type ModScore,
	type SessionScore,
	sessionScoreMod,
	type StandardNormalQuantile,
} from "./_types";

// ---- Signal Detection Theory ----
export {
	type CorrectedRates,
	correctedRates,
	sdtFromCounts,
	standardNormalQuantile,
} from "./_sdt";

// ---- Projections ----
export {
	projectTrialFeedback,
	reconstructTrials,
	projectSessionScore,
} from "./_project";

// ---- Session query (token search over a SessionSpec) ----
export {
	type Token,
	parseQuery,
	matchesQuery,
	defaultQuery,
} from "./_query";
