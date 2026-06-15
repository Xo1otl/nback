/**
 * Projections over a `game.SessionRecord` (§intro, §Scoring).
 *
 * Events are a flat, append-only log with no trial index; trial boundaries are
 * recovered by counting `trialAdvanced` events (the session starts in trial 0,
 * and each `trialAdvanced` moves to the next trial). A trial is *scored* only if
 * it is past the memorization phase AND actually reached feedback (a
 * `trialClosed` was logged for it) — so an aborted or otherwise incomplete
 * session scores only the trials the player truly completed, never the
 * pre-generated trials they never saw.
 *
 * For each scored trial and enabled modality the judgment is determined by:
 *
 *   - match:        stimulus[m][t] == stimulus[m][t - N]   (game.matchAt)
 *   - final state:  the last accepted `respond` action for the mod in trial t,
 *                   defaulting to disengage                (game.finalEngagedFrom)
 *
 * Both the match rule and the response fold live in `game` and are shared with
 * the driver's live feedback, so the live and post-hoc judgments cannot drift.
 */

import * as game from "@/game";
import { sdtFromCounts, standardNormalQuantile } from "./_sdt";
import {
	type ModCounts,
	type ModJudgment,
	type ModScore,
	type SessionScore,
	type StandardNormalQuantile,
	type TrialFeedback,
} from "./_types";

type Segmented = {
	/** `responded` events (accepted or not) grouped by the trial they occurred in. */
	readonly byTrial: Map<game.TrialIndex, game.Responded[]>;
	/** Trials that reached feedback — i.e. a `trialClosed` was logged for them. */
	readonly closedTrials: Set<game.TrialIndex>;
};

/** Walk the event log once, recovering per-trial buckets and the closed trials. */
function segmentEvents(events: readonly game.Event[]): Segmented {
	const byTrial = new Map<game.TrialIndex, game.Responded[]>();
	const closedTrials = new Set<game.TrialIndex>();
	let trial = 0;
	for (const ev of events) {
		if (ev.type === "responded") {
			const bucket = byTrial.get(trial);
			if (bucket) {
				bucket.push(ev);
			} else {
				byTrial.set(trial, [ev]);
			}
		} else if (ev.type === "trialClosed") {
			// responding(t) -> feedback(t): trial t completed (does NOT advance t).
			closedTrials.add(trial);
		} else if (ev.type === "trialAdvanced") {
			trial++;
		}
	}
	return { byTrial, closedTrials };
}

function judgeTrial(
	record: game.SessionRecord,
	seg: Segmented,
	t: game.TrialIndex,
): TrialFeedback | undefined {
	const spec = record.spec;
	// Score only trials past memorization that actually reached feedback. An
	// unreached trial (aborted/incomplete session) must NOT be fabricated as an
	// all-disengaged Miss/CorrectReject.
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

/** Fold the events for trial `t` into per-modality judgments (scored only). */
export function projectTrialFeedback(
	record: game.SessionRecord,
	t: game.TrialIndex,
): TrialFeedback | undefined {
	return judgeTrial(record, segmentEvents(record.events), t);
}

/** {@link projectTrialFeedback} across every scored trial, in trial order. */
export function reconstructTrials(
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

/**
 * Aggregate judgments into per-modality counts + SDT, in spec order (§Scoring).
 * `q` defaults to {@link standardNormalQuantile}. For an incomplete session only
 * completed trials are counted, so H + M + F + C <= problemCount — and equals it
 * exactly once the session has run to completion.
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
		return { counts, sdt: sdtFromCounts(counts, q) };
	});

	return { mods };
}
