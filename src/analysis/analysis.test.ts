import { describe, expect, test } from "bun:test";
import * as game from "@/game";
import * as analysis from "@/analysis";

// ---- Builders ----------------------------------------------------------

const TIMING: game.TimingConfig = {
	respondingDuration: 2000,
	feedbackDuration: 500,
};

function spec(
	n: number,
	problemCount: number,
	mods: readonly game.ModID[] = [game.MOD_COLOR],
): game.SessionSpec {
	return game.validateAndResolveConfig({
		n,
		problemCount,
		matchProbability: 0.5,
		timing: TIMING,
		mods: mods.map((mod) => ({
			mod,
			options: mod === game.MOD_COLOR ? game.CANONICAL_COLOR : game.CANONICAL_SHAPE,
		})),
	});
}

/** A single-color trial stimulus. */
function colorTrial(trial: number, value: game.Option): game.TrialStimulus {
	return { trial, values: [{ mod: game.MOD_COLOR, value }] };
}

function accepted(action: game.ResponseAction): game.Responded {
	return { type: "responded", offset: 0, mod: game.MOD_COLOR, action, result: "accepted", reason: "" };
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

// ---- Outcome predicates ------------------------------------------------

describe("outcome predicates", () => {
	test("match / engaged / correct classification", () => {
		expect(analysis.outcomeIsMatch(analysis.OUTCOME_HIT)).toBe(true);
		expect(analysis.outcomeIsMatch(analysis.OUTCOME_MISS)).toBe(true);
		expect(analysis.outcomeIsMatch(analysis.OUTCOME_FALSE_ALARM)).toBe(false);
		expect(analysis.outcomeIsMatch(analysis.OUTCOME_CORRECT_REJECT)).toBe(false);

		expect(analysis.outcomeIsEngaged(analysis.OUTCOME_HIT)).toBe(true);
		expect(analysis.outcomeIsEngaged(analysis.OUTCOME_FALSE_ALARM)).toBe(true);
		expect(analysis.outcomeIsEngaged(analysis.OUTCOME_MISS)).toBe(false);
		expect(analysis.outcomeIsEngaged(analysis.OUTCOME_CORRECT_REJECT)).toBe(false);

		expect(analysis.outcomeIsCorrect(analysis.OUTCOME_HIT)).toBe(true);
		expect(analysis.outcomeIsCorrect(analysis.OUTCOME_CORRECT_REJECT)).toBe(true);
		expect(analysis.outcomeIsCorrect(analysis.OUTCOME_MISS)).toBe(false);
		expect(analysis.outcomeIsCorrect(analysis.OUTCOME_FALSE_ALARM)).toBe(false);
	});
});

// ---- SDT math ----------------------------------------------------------

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
		expect(hr).toBeCloseTo(0.75, 12); // (1 + .5) / (1 + 0 + 1)
		expect(far).toBeCloseTo(0.25, 12); // (0 + .5) / (0 + 1 + 1)
	});

	test("HR and FAR use independent denominators (H+M vs F+C)", () => {
		// Distinct H+M (4) and F+C (6) so a denominator swap would change the result.
		const counts: analysis.ModCounts = { mod: game.MOD_COLOR, h: 3, m: 1, f: 1, c: 5 };
		const { hr, far } = analysis.correctedRates(counts);
		expect(hr).toBeCloseTo(3.5 / 5, 12); // (3 + .5) / (3 + 1 + 1) = 0.7
		expect(far).toBeCloseTo(1.5 / 7, 12); // (1 + .5) / (1 + 5 + 1) = 0.214285…
	});

	test("d' and criterion from counts", () => {
		const counts: analysis.ModCounts = { mod: game.MOD_COLOR, h: 1, m: 0, f: 0, c: 1 };
		const sdt = analysis.sdtFromCounts(counts, analysis.standardNormalQuantile);
		// Z(.75) - Z(.25) = 2 * Z(.75)
		expect(sdt.dPrime).toBeCloseTo(2 * 0.6744897502, 6);
		expect(sdt.criterion).toBeCloseTo(0, 9);
	});

	test("criterion sign & magnitude: liberal responder gives c < 0", () => {
		// Biased-yes responder (HR & FAR both high) -> negative criterion.
		const counts: analysis.ModCounts = { mod: game.MOD_COLOR, h: 8, m: 2, f: 6, c: 4 };
		const sdt = analysis.sdtFromCounts(counts, analysis.standardNormalQuantile);
		expect(sdt.dPrime).toBeCloseTo(0.5179744768, 6);
		expect(sdt.criterion).toBeCloseTo(-0.4888713557, 6);
	});

	test("criterion sign: conservative responder gives c > 0", () => {
		// Biased-no responder (HR & FAR both low) -> positive criterion.
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

	test("countsTotal sums all four cells", () => {
		expect(analysis.countsTotal({ mod: game.MOD_COLOR, h: 1, m: 2, f: 3, c: 4 })).toBe(10);
	});
});

// ---- Projection: per-trial judgments ----------------------------------

describe("projectTrialFeedback", () => {
	// n = 1, T = 3. trial0 memo; trials 1,2 scored.
	const s = spec(1, 2);

	test("Hit: match + final engaged", () => {
		const r = record(
			s,
			[colorTrial(0, "red"), colorTrial(1, "red"), colorTrial(2, "green")],
			[CLOSED, ADVANCED, accepted("engage"), CLOSED, ADVANCED, CLOSED, ADVANCED],
		);
		const fb = analysis.projectTrialFeedback(r, 1);
		expect(fb?.judgments).toEqual([
			{ mod: game.MOD_COLOR, outcome: analysis.OUTCOME_HIT },
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
			{ mod: game.MOD_COLOR, outcome: analysis.OUTCOME_CORRECT_REJECT },
		]);
	});

	test("Miss: match + final disengaged (last accepted action wins)", () => {
		const r = record(
			s,
			[colorTrial(0, "red"), colorTrial(1, "red"), colorTrial(2, "green")],
			// trial 1: engage then disengage -> final disengaged
			[CLOSED, ADVANCED, accepted("engage"), accepted("disengage"), CLOSED, ADVANCED, CLOSED, ADVANCED],
		);
		expect(analysis.projectTrialFeedback(r, 1)?.judgments[0]?.outcome).toBe(
			analysis.OUTCOME_MISS,
		);
	});

	test("FalseAlarm: no match + final engaged", () => {
		const r = record(
			s,
			[colorTrial(0, "red"), colorTrial(1, "green"), colorTrial(2, "blue" as game.Option)],
			// trial 2: engage on a non-match
			[CLOSED, ADVANCED, CLOSED, ADVANCED, accepted("engage"), CLOSED, ADVANCED],
		);
		// trial 1: green vs red -> non-match, no response -> CorrectReject
		expect(analysis.projectTrialFeedback(r, 1)?.judgments[0]?.outcome).toBe(
			analysis.OUTCOME_CORRECT_REJECT,
		);
		// trial 2: blue vs green -> non-match, engaged -> FalseAlarm
		expect(analysis.projectTrialFeedback(r, 2)?.judgments[0]?.outcome).toBe(
			analysis.OUTCOME_FALSE_ALARM,
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
				// a rejected engage afterwards must NOT flip state back; only accepted count
				{ type: "responded", offset: 0, mod: game.MOD_COLOR, action: "disengage", result: "rejected", reason: "outsideWindow" },
				CLOSED,
				ADVANCED,
				CLOSED,
				ADVANCED,
			],
		);
		expect(analysis.projectTrialFeedback(r, 1)?.judgments[0]?.outcome).toBe(
			analysis.OUTCOME_HIT,
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

// ---- Projection: session score -----------------------------------------

describe("projectSessionScore & reconstructTrials", () => {
	const s = spec(1, 2);
	const r = record(
		s,
		[colorTrial(0, "red"), colorTrial(1, "red"), colorTrial(2, "green")],
		[CLOSED, ADVANCED, accepted("engage"), CLOSED, ADVANCED, CLOSED, ADVANCED],
	);

	test("reconstructs only scored trials in order", () => {
		const trials = analysis.reconstructTrials(r);
		expect(trials.map((t) => t.trial)).toEqual([1, 2]);
	});

	test("aggregates counts and counts sum to problemCount", () => {
		const score = analysis.projectSessionScore(r);
		const color = analysis.sessionScoreMod(score, game.MOD_COLOR);
		expect(color?.counts).toEqual({ mod: game.MOD_COLOR, h: 1, m: 0, f: 0, c: 1 });
		expect(analysis.countsTotal(color!.counts)).toBe(s.problemCount);
		expect(color?.sdt.criterion).toBeCloseTo(0, 9);
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
		// Each mod is judged against its OWN stream (independent streams): shape
		// repeats (square==square -> Miss, no engage), color differs (red->green
		// -> CorrectReject). A bug crossing the streams would change these.
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

// ---- Projection: incomplete / aborted sessions -------------------------

describe("incomplete / aborted sessions", () => {
	// n = 1, T = 6: trial 0 memo, trials 1..5 scored. Stimuli are pre-generated
	// for ALL trials even if the player never reaches them.
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
		// Closed trials 0 and 1 (engaged on the trial-1 match), then aborted before
		// trial 2 ever closed. Trials 2..5 were never completed.
		const r = record(s, stimuli, [
			CLOSED,
			ADVANCED,
			accepted("engage"),
			CLOSED,
			ADVANCED,
		]);
		// only the scored trial that closed (trial 1) is reconstructed
		expect(analysis.reconstructTrials(r).map((t) => t.trial)).toEqual([1]);
		const color = analysis.sessionScoreMod(
			analysis.projectSessionScore(r),
			game.MOD_COLOR,
		)!;
		expect(color.counts).toEqual({ mod: game.MOD_COLOR, h: 1, m: 0, f: 0, c: 0 });
		// honest total: <= problemCount, NOT fabricated up to 5 from unseen trials
		expect(analysis.countsTotal(color.counts)).toBe(1);
	});

	test("a session aborted during the memorization feedback scores nothing", () => {
		const r = record(s, stimuli, [CLOSED]); // closed trial 0 (memo) only
		expect(analysis.reconstructTrials(r)).toEqual([]);
		const color = analysis.sessionScoreMod(
			analysis.projectSessionScore(r),
			game.MOD_COLOR,
		)!;
		expect(analysis.countsTotal(color.counts)).toBe(0);
	});

	test("projectTrialFeedback returns undefined for a scored trial never reached", () => {
		const r = record(s, stimuli, [CLOSED]); // never advanced past trial 0
		expect(analysis.projectTrialFeedback(r, 3)).toBeUndefined();
	});
});
