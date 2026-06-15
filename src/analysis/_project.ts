/**
 * Projections over a `game.SessionRecord` (§intro, §Scoring).
 *
 * Events are a flat, append-only log with no trial index; trial boundaries are
 * recovered by counting `trialAdvanced` events (the session starts in trial 0,
 * and each `trialAdvanced` moves to the next trial). For each scored trial and
 * enabled modality the judgment is determined by:
 *
 *   - match:        stimulus[m][t] == stimulus[m][t - N]   (stable-ID equality)
 *   - final state:  the last accepted `respond` action for the mod in trial t,
 *                   defaulting to disengage.
 */

import * as game from "@/game";
import { sdtFromCounts, standardNormalQuantile } from "./_sdt";
import {
	type ModCounts,
	type ModJudgment,
	type ModScore,
	type Outcome,
	OUTCOME_CORRECT_REJECT,
	OUTCOME_FALSE_ALARM,
	OUTCOME_HIT,
	OUTCOME_MISS,
	type SessionScore,
	type StandardNormalQuantile,
	type TrialFeedback,
} from "./_types";

/** Group accepted-or-not `responded` events by the trial they occurred in. */
function respondedByTrial(
	events: readonly game.Event[],
): Map<game.TrialIndex, game.Responded[]> {
	const byTrial = new Map<game.TrialIndex, game.Responded[]>();
	let trial = 0;
	for (const ev of events) {
		if (ev.type === "responded") {
			const bucket = byTrial.get(trial);
			if (bucket) {
				bucket.push(ev);
			} else {
				byTrial.set(trial, [ev]);
			}
		} else if (ev.type === "trialAdvanced") {
			trial++;
		}
		// trialClosed does not change the trial index (responding -> feedback).
	}
	return byTrial;
}

/** Last accepted action for `mod`, defaulting to disengaged (§Scoring). */
function finalEngaged(
	responded: readonly game.Responded[],
	mod: game.ModID,
): boolean {
	let engaged = false;
	for (const r of responded) {
		if (r.mod === mod && r.result === "accepted") {
			engaged = r.action === "engage";
		}
	}
	return engaged;
}

function outcomeOf(matched: boolean, engaged: boolean): Outcome {
	if (matched) {
		return engaged ? OUTCOME_HIT : OUTCOME_MISS;
	}
	return engaged ? OUTCOME_FALSE_ALARM : OUTCOME_CORRECT_REJECT;
}

function judgeTrial(
	record: game.SessionRecord,
	byTrial: Map<game.TrialIndex, game.Responded[]>,
	t: game.TrialIndex,
): TrialFeedback | undefined {
	const spec = record.spec;
	if (!game.isScoredTrial(spec, t)) {
		return undefined;
	}

	const cur = record.stimuli.find((s) => s.trial === t);
	const prev = record.stimuli.find((s) => s.trial === t - spec.n);
	if (!cur || !prev) {
		return undefined;
	}

	const responded = byTrial.get(t) ?? [];
	const judgments: ModJudgment[] = spec.mods.map((mc) => {
		const curValue = game.trialStimulusValue(cur, mc.mod);
		const prevValue = game.trialStimulusValue(prev, mc.mod);
		const matched =
			curValue !== undefined &&
			prevValue !== undefined &&
			curValue === prevValue;
		const engaged = finalEngaged(responded, mc.mod);
		return { mod: mc.mod, outcome: outcomeOf(matched, engaged) };
	});

	return { trial: t, judgments };
}

/** Fold the events for trial `t` into per-modality judgments (scored only). */
export function projectTrialFeedback(
	record: game.SessionRecord,
	t: game.TrialIndex,
): TrialFeedback | undefined {
	return judgeTrial(record, respondedByTrial(record.events), t);
}

/** {@link projectTrialFeedback} across every scored trial, in trial order. */
export function reconstructTrials(
	record: game.SessionRecord,
): TrialFeedback[] {
	const byTrial = respondedByTrial(record.events);
	const total = game.totalTrials(record.spec);
	const out: TrialFeedback[] = [];
	for (let t = 0; t < total; t++) {
		const feedback = judgeTrial(record, byTrial, t);
		if (feedback) {
			out.push(feedback);
		}
	}
	return out;
}

/**
 * Aggregate judgments into per-modality counts + SDT, in spec order
 * (§Scoring). `q` defaults to {@link standardNormalQuantile}.
 */
export function projectSessionScore(
	record: game.SessionRecord,
	q: StandardNormalQuantile = standardNormalQuantile,
): SessionScore {
	const trials = reconstructTrials(record);

	type Tally = { h: number; m: number; f: number; c: number };
	const tallies = new Map<game.ModID, Tally>();
	for (const mc of record.spec.mods) {
		tallies.set(mc.mod, { h: 0, m: 0, f: 0, c: 0 });
	}

	for (const tf of trials) {
		for (const j of tf.judgments) {
			const tally = tallies.get(j.mod);
			if (!tally) continue;
			switch (j.outcome) {
				case OUTCOME_HIT:
					tally.h++;
					break;
				case OUTCOME_MISS:
					tally.m++;
					break;
				case OUTCOME_FALSE_ALARM:
					tally.f++;
					break;
				case OUTCOME_CORRECT_REJECT:
					tally.c++;
					break;
			}
		}
	}

	const mods: ModScore[] = record.spec.mods.map((mc) => {
		const tally = tallies.get(mc.mod)!;
		const counts: ModCounts = {
			mod: mc.mod,
			h: tally.h,
			m: tally.m,
			f: tally.f,
			c: tally.c,
		};
		return { counts, sdt: sdtFromCounts(counts, q) };
	});

	return { mods };
}
