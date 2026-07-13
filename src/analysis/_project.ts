/**
 * INVARIANT: match (game.matchAt) + final-state fold (game.finalEngagedFrom)
 * live in `game`, shared w/ driver live feedback → live & post-hoc cannot drift.
 */

import * as game from "@/game";
import { sdtFromCounts, standardNormalQuantile } from "./_sdt";
import {
	countsTotal,
	type ModCounts,
	type ModJudgment,
	type ModScore,
	type SessionScore,
	type StandardNormalQuantile,
	type TrialFeedback,
} from "./_types";

type Segmented = {
	/** `responded` events (accepted or not) by trial. */
	readonly byTrial: Map<game.TrialIndex, game.Responded[]>;
	/** trials that reached feedback (`trialClosed` logged). */
	readonly closedTrials: ReadonlySet<game.TrialIndex>;
};

function segmentEvents(events: readonly game.Event[]): Segmented {
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
	}
	return { byTrial, closedTrials: game.closedTrials(events) };
}

function judgeTrial(
	record: game.SessionRecord,
	seg: Segmented,
	t: game.TrialIndex,
): TrialFeedback | undefined {
	const spec = record.spec;
	// HAZARD: unreached trial must NOT be fabricated as all-disengaged Miss/CR
	if (!game.isScoredTrial(spec, t) || !seg.closedTrials.has(t)) {
		return undefined;
	}

	const responded = seg.byTrial.get(t) ?? [];
	const judgments: ModJudgment[] = spec.mods.map((mc) => {
		const matched = game.matchAt(record.stimuli, spec.n, t, mc.mod) ?? false;
		const engaged = game.finalEngagedFrom(responded, mc.mod);
		return { mod: mc.mod, outcome: game.outcomeOf(matched, engaged) };
	});

	return { trial: t, judgments };
}

export function projectTrialFeedback(
	record: game.SessionRecord,
	t: game.TrialIndex,
): TrialFeedback | undefined {
	return judgeTrial(record, segmentEvents(record.events), t);
}

export function projectTrialFeedbacks(
	record: game.SessionRecord,
): TrialFeedback[] {
	const seg = segmentEvents(record.events);
	const total = game.totalTrials(record.spec);
	const out: TrialFeedback[] = [];
	for (let t = 0; t < total; t++) {
		const feedback = judgeTrial(record, seg, t);
		if (feedback) {
			out.push(feedback);
		}
	}
	return out;
}

/** Per-modality counts + SDT, spec order. Incomplete session ⇒ H+M+F+C ≤ problemCount. §Scoring */
export function projectSessionScore(
	record: game.SessionRecord,
	q: StandardNormalQuantile = standardNormalQuantile,
): SessionScore {
	const trials = projectTrialFeedbacks(record);

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
				case game.OUTCOME_HIT:
					tally.h++;
					break;
				case game.OUTCOME_MISS:
					tally.m++;
					break;
				case game.OUTCOME_FALSE_ALARM:
					tally.f++;
					break;
				case game.OUTCOME_CORRECT_REJECT:
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
		// zero observations ⇒ no sdt; log-linear correction is for sparse cells, not absent data
		return countsTotal(counts) === 0
			? { counts }
			: { counts, sdt: sdtFromCounts(counts, q) };
	});

	return { mods };
}
