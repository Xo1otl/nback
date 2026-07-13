import { describe, expect, test } from "bun:test";
import * as game from "@/game";
import * as analysis from "@/analysis";
// package test: package-private import (not public surface)
import { projectTrialFeedbacks } from "./_project";

const TIMING: game.TimingConfig = {
	respondingDuration: 2000,
	feedbackDuration: 500,
};

function spec(
	n: number,
	problemCount: number,
	mods: readonly game.ModID[] = [game.MOD_COLOR],
): game.SessionSpec {
	const resolved = game.validateAndResolveConfig({
		n,
		problemCount,
		matchProbability: 0.5,
		timing: TIMING,
		mods: mods.map((mod) => ({
			mod,
			options: mod === game.MOD_COLOR ? game.CANONICAL_COLOR : game.CANONICAL_SHAPE,
		})),
	});
	if (resolved instanceof game.ConfigError) throw resolved;
	return resolved;
}

function colorTrial(trial: number, value: game.Option): game.TrialStimulus {
	return { trial, values: [{ mod: game.MOD_COLOR, value }] };
}

function accepted(action: game.ResponseAction): game.Responded {
	return { type: "responded", offset: 0, mod: game.MOD_COLOR, action, reason: "" };
}

const ADVANCED: game.TrialAdvanced = { type: "trialAdvanced", offset: 0 };
const CLOSED: game.TrialClosed = { type: "trialClosed", offset: 0 };

function record(
	s: game.SessionSpec,
	stimuli: game.StimulusTrace,
	events: readonly game.Event[],
): game.SessionRecord {
	return game.newSessionRecord("sess", s, "seed", stimuli, 0, events);
}

describe("standardNormalQuantile", () => {
	const Z = analysis.standardNormalQuantile;

	test("Z(0.5) = 0", () => {
		expect(Z(0.5)).toBeCloseTo(0, 9);
	});

	test("known quantiles", () => {
		expect(Z(0.975)).toBeCloseTo(1.959963985, 6);
		expect(Z(0.025)).toBeCloseTo(-1.959963985, 6);
		expect(Z(0.75)).toBeCloseTo(0.6744897502, 6);
		expect(Z(0.9)).toBeCloseTo(1.281551566, 6);
	});

	test("known quantiles in the rational-approximation tails (p < 0.02425, p > 0.97575)", () => {
		expect(Z(0.001)).toBeCloseTo(-3.09023231, 6);
		expect(Z(0.005)).toBeCloseTo(-2.5758293, 6);
		expect(Z(0.995)).toBeCloseTo(2.5758293, 6);
		expect(Z(0.999)).toBeCloseTo(3.09023231, 6);
	});

	test("is antisymmetric about 0.5", () => {
		for (const p of [0.1, 0.3, 0.42, 0.88]) {
			expect(Z(p)).toBeCloseTo(-Z(1 - p), 8);
		}
	});

	test("saturates at the open-interval boundaries", () => {
		expect(Z(0)).toBe(-Infinity);
		expect(Z(1)).toBe(Infinity);
	});
});

describe("correctedRates & sdtFromCounts", () => {
	test("log-linear corrected rates", () => {
		const counts: analysis.ModCounts = { mod: game.MOD_COLOR, h: 1, m: 0, f: 0, c: 1 };
		const { hr, far } = analysis.correctedRates(counts);
		expect(hr).toBeCloseTo(0.75, 12); // (1+.5)/(1+0+1)
		expect(far).toBeCloseTo(0.25, 12); // (0+.5)/(0+1+1)
	});

	test("HR and FAR use independent denominators (H+M vs F+C)", () => {
		// distinct H+M vs F+C: denominator swap would change result
		const counts: analysis.ModCounts = { mod: game.MOD_COLOR, h: 3, m: 1, f: 1, c: 5 };
		const { hr, far } = analysis.correctedRates(counts);
		expect(hr).toBeCloseTo(3.5 / 5, 12); // (3+.5)/(3+1+1)
		expect(far).toBeCloseTo(1.5 / 7, 12); // (1+.5)/(1+5+1)
	});

	test("d' and criterion from counts", () => {
		const counts: analysis.ModCounts = { mod: game.MOD_COLOR, h: 1, m: 0, f: 0, c: 1 };
		const sdt = analysis.sdtFromCounts(counts, analysis.standardNormalQuantile);
		// Z(.75) - Z(.25) = 2*Z(.75)
		expect(sdt.dPrime).toBeCloseTo(2 * 0.6744897502, 6);
		expect(sdt.criterion).toBeCloseTo(0, 9);
	});

	test("criterion sign & magnitude: liberal responder gives c < 0", () => {
		const counts: analysis.ModCounts = { mod: game.MOD_COLOR, h: 8, m: 2, f: 6, c: 4 };
		const sdt = analysis.sdtFromCounts(counts, analysis.standardNormalQuantile);
		expect(sdt.dPrime).toBeCloseTo(0.5179744768, 6);
		expect(sdt.criterion).toBeCloseTo(-0.4888713557, 6);
	});

	test("criterion sign: conservative responder gives c > 0", () => {
		const counts: analysis.ModCounts = { mod: game.MOD_COLOR, h: 2, m: 8, f: 0, c: 10 };
		const sdt = analysis.sdtFromCounts(counts, analysis.standardNormalQuantile);
		expect(sdt.criterion).toBeCloseTo(1.2192401115, 6);
		expect(sdt.criterion).toBeGreaterThan(0);
	});

	test("chance performance gives d' ~ 0", () => {
		const counts: analysis.ModCounts = { mod: game.MOD_COLOR, h: 5, m: 5, f: 5, c: 5 };
		const sdt = analysis.sdtFromCounts(counts, analysis.standardNormalQuantile);
		expect(sdt.dPrime).toBeCloseTo(0, 9);
	});

	test("all-correct-reject counts drive FAR through the lower quantile tail", () => {
		// FAR = 0.5/26 ~ 0.0192 < P_LOW; HR = 0.5 → d' = -Z(FAR), c = -Z(FAR)/2
		const counts: analysis.ModCounts = { mod: game.MOD_COLOR, h: 0, m: 0, f: 0, c: 25 };
		const sdt = analysis.sdtFromCounts(counts, analysis.standardNormalQuantile);
		expect(sdt.dPrime).toBeCloseTo(2.0699018309, 6);
		expect(sdt.criterion).toBeCloseTo(1.0349509154, 6);
	});

	test("countsTotal sums all four cells", () => {
		expect(analysis.countsTotal({ mod: game.MOD_COLOR, h: 1, m: 2, f: 3, c: 4 })).toBe(10);
	});
});

describe("projectTrialFeedback", () => {
	// n=1, T=3: trial0 memo, trials 1,2 scored
	const s = spec(1, 2);

	test("Hit: match + final engaged", () => {
		const r = record(
			s,
			[colorTrial(0, "red"), colorTrial(1, "red"), colorTrial(2, "green")],
			[CLOSED, ADVANCED, accepted("engage"), CLOSED, ADVANCED, CLOSED, ADVANCED],
		);
		const fb = analysis.projectTrialFeedback(r, 1);
		expect(fb?.judgments).toEqual([
			{ mod: game.MOD_COLOR, outcome: game.OUTCOME_HIT },
		]);
	});

	test("CorrectReject: no match + default disengaged (no events)", () => {
		const r = record(
			s,
			[colorTrial(0, "red"), colorTrial(1, "red"), colorTrial(2, "green")],
			[CLOSED, ADVANCED, accepted("engage"), CLOSED, ADVANCED, CLOSED, ADVANCED],
		);
		const fb = analysis.projectTrialFeedback(r, 2);
		expect(fb?.judgments).toEqual([
			{ mod: game.MOD_COLOR, outcome: game.OUTCOME_CORRECT_REJECT },
		]);
	});

	test("Miss: match + final disengaged (last accepted action wins)", () => {
		const r = record(
			s,
			[colorTrial(0, "red"), colorTrial(1, "red"), colorTrial(2, "green")],
			// trial 1: engage then disengage → final disengaged
			[CLOSED, ADVANCED, accepted("engage"), accepted("disengage"), CLOSED, ADVANCED, CLOSED, ADVANCED],
		);
		expect(analysis.projectTrialFeedback(r, 1)?.judgments[0]?.outcome).toBe(
			game.OUTCOME_MISS,
		);
	});

	test("FalseAlarm: no match + final engaged", () => {
		const r = record(
			s,
			[colorTrial(0, "red"), colorTrial(1, "green"), colorTrial(2, "blue" as game.Option)],
			// trial 2: engage on a non-match
			[CLOSED, ADVANCED, CLOSED, ADVANCED, accepted("engage"), CLOSED, ADVANCED],
		);
		// trial 1: green vs red → non-match, no response → CorrectReject
		expect(analysis.projectTrialFeedback(r, 1)?.judgments[0]?.outcome).toBe(
			game.OUTCOME_CORRECT_REJECT,
		);
		// trial 2: blue vs green → non-match, engaged → FalseAlarm
		expect(analysis.projectTrialFeedback(r, 2)?.judgments[0]?.outcome).toBe(
			game.OUTCOME_FALSE_ALARM,
		);
	});

	test("rejected/ignored responses do not change the final state", () => {
		const r = record(
			s,
			[colorTrial(0, "red"), colorTrial(1, "red"), colorTrial(2, "green")],
			[
				CLOSED,
				ADVANCED,
				accepted("engage"),
				// rejected disengage must NOT flip state; only accepted count
				{ type: "responded", offset: 0, mod: game.MOD_COLOR, action: "disengage", reason: "outsideWindow" },
				CLOSED,
				ADVANCED,
				CLOSED,
				ADVANCED,
			],
		);
		expect(analysis.projectTrialFeedback(r, 1)?.judgments[0]?.outcome).toBe(
			game.OUTCOME_HIT,
		);
	});

	test("memorization trials are not projected", () => {
		const r = record(
			s,
			[colorTrial(0, "red"), colorTrial(1, "red"), colorTrial(2, "green")],
			[CLOSED, ADVANCED, CLOSED, ADVANCED, CLOSED, ADVANCED],
		);
		expect(analysis.projectTrialFeedback(r, 0)).toBeUndefined();
	});
});

describe("projectSessionScore & projectTrialFeedbacks", () => {
	const s = spec(1, 2);
	const r = record(
		s,
		[colorTrial(0, "red"), colorTrial(1, "red"), colorTrial(2, "green")],
		[CLOSED, ADVANCED, accepted("engage"), CLOSED, ADVANCED, CLOSED, ADVANCED],
	);

	test("projects only scored trials in order", () => {
		const trials = projectTrialFeedbacks(r);
		expect(trials.map((t) => t.trial)).toEqual([1, 2]);
	});

	test("aggregates counts and counts sum to problemCount", () => {
		const score = analysis.projectSessionScore(r);
		const color = analysis.sessionScoreMod(score, game.MOD_COLOR);
		expect(color?.counts).toEqual({ mod: game.MOD_COLOR, h: 1, m: 0, f: 0, c: 1 });
		expect(analysis.countsTotal(color!.counts)).toBe(s.problemCount);
		expect(color?.sdt?.criterion).toBeCloseTo(0, 9);
	});

	test("preserves spec order across modalities", () => {
		const s2 = spec(1, 1, [game.MOD_SHAPE, game.MOD_COLOR]);
		const stimuli: game.StimulusTrace = [
			{ trial: 0, values: [{ mod: game.MOD_SHAPE, value: "square" }, { mod: game.MOD_COLOR, value: "red" }] },
			{ trial: 1, values: [{ mod: game.MOD_SHAPE, value: "square" }, { mod: game.MOD_COLOR, value: "green" }] },
		];
		const r2 = record(s2, stimuli, [CLOSED, ADVANCED, CLOSED, ADVANCED]);
		const score = analysis.projectSessionScore(r2);
		expect(score.mods.map((m) => m.counts.mod)).toEqual([game.MOD_SHAPE, game.MOD_COLOR]);
		// independent streams: shape repeats→Miss, color differs→CorrectReject; crossing streams would change these
		expect(analysis.sessionScoreMod(score, game.MOD_SHAPE)?.counts).toEqual({
			mod: game.MOD_SHAPE,
			h: 0,
			m: 1,
			f: 0,
			c: 0,
		});
		expect(analysis.sessionScoreMod(score, game.MOD_COLOR)?.counts).toEqual({
			mod: game.MOD_COLOR,
			h: 0,
			m: 0,
			f: 0,
			c: 1,
		});
	});
});

describe("incomplete / aborted sessions", () => {
	// n=1, T=6: trial0 memo, trials 1..5 scored. Stimuli pre-generated for ALL trials (even unreached)
	const s = spec(1, 5);
	const stimuli: game.StimulusTrace = [
		colorTrial(0, "red"),
		colorTrial(1, "red"), // matches t-1 (red)
		colorTrial(2, "green"),
		colorTrial(3, "green"),
		colorTrial(4, "red"),
		colorTrial(5, "red"),
	];

	test("scores only trials that actually reached feedback (aborted mid-session)", () => {
		// closed trials 0,1 (engaged on trial-1 match), aborted before trial 2 closed
		const r = record(s, stimuli, [
			CLOSED,
			ADVANCED,
			accepted("engage"),
			CLOSED,
			ADVANCED,
		]);
		expect(projectTrialFeedbacks(r).map((t) => t.trial)).toEqual([1]);
		const color = analysis.sessionScoreMod(
			analysis.projectSessionScore(r),
			game.MOD_COLOR,
		)!;
		expect(color.counts).toEqual({ mod: game.MOD_COLOR, h: 1, m: 0, f: 0, c: 0 });
		// honest total ≤ problemCount, NOT fabricated to 5 from unseen trials
		expect(analysis.countsTotal(color.counts)).toBe(1);
	});

	test("a session aborted during the memorization feedback scores nothing", () => {
		const r = record(s, stimuli, [CLOSED]); // closed trial 0 (memo) only
		expect(projectTrialFeedbacks(r)).toEqual([]);
		const color = analysis.sessionScoreMod(
			analysis.projectSessionScore(r),
			game.MOD_COLOR,
		)!;
		expect(analysis.countsTotal(color.counts)).toBe(0);
		// zero observations must NOT fabricate d'=0/c=0 from corrected 0.5/0.5 rates
		expect(color.sdt).toBeUndefined();
	});

	test("projectTrialFeedback returns undefined for a scored trial never reached", () => {
		const r = record(s, stimuli, [CLOSED]); // never advanced past trial 0
		expect(analysis.projectTrialFeedback(r, 3)).toBeUndefined();
	});
});

describe("n = 2 lookback composition", () => {
	// n=2, T=5: trials 0,1 memo; trials 2,3,4 scored against t-2
	const s = spec(2, 3);
	const stimuli: game.StimulusTrace = [
		colorTrial(0, "red"),
		colorTrial(1, "green"),
		colorTrial(2, "red"), // = trial 0 → match (a t-1 reading: non-match)
		colorTrial(3, "green"), // = trial 1 → match
		colorTrial(4, "green"), // ≠ trial 2 → non-match (a t-1 reading: match)
	];
	// engage on trial 2 only
	const r = record(s, stimuli, [
		CLOSED,
		ADVANCED,
		CLOSED,
		ADVANCED,
		accepted("engage"),
		CLOSED,
		ADVANCED,
		CLOSED,
		ADVANCED,
		CLOSED,
		ADVANCED,
	]);

	test("exactly n memorization trials are excluded; scoring starts at trial n", () => {
		expect(analysis.projectTrialFeedback(r, 0)).toBeUndefined();
		expect(analysis.projectTrialFeedback(r, 1)).toBeUndefined();
		expect(projectTrialFeedbacks(r).map((t) => t.trial)).toEqual([2, 3, 4]);
	});

	test("matches are judged against t-2; a t-1 reading would flip the outcomes", () => {
		expect(analysis.projectTrialFeedback(r, 2)?.judgments[0]?.outcome).toBe(
			game.OUTCOME_HIT,
		);
		expect(analysis.projectTrialFeedback(r, 3)?.judgments[0]?.outcome).toBe(
			game.OUTCOME_MISS,
		);
		expect(analysis.projectTrialFeedback(r, 4)?.judgments[0]?.outcome).toBe(
			game.OUTCOME_CORRECT_REJECT,
		);
		const color = analysis.sessionScoreMod(
			analysis.projectSessionScore(r),
			game.MOD_COLOR,
		)!;
		expect(color.counts).toEqual({ mod: game.MOD_COLOR, h: 1, m: 1, f: 0, c: 1 });
		expect(analysis.countsTotal(color.counts)).toBe(s.problemCount);
	});
});
