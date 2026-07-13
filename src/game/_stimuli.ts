/**
 * Stimulus generation (§Generation), independent per modality/trial:
 *   t < N:  uniform from O_m.
 *   t >= N: prob p → copy value at t-N (match); else uniform from O_m \ {t-N value} (non-match).
 */

import {
	type ModID,
	type ModStimulus,
	type Option,
	type RandomSource,
	type SessionSpec,
	type StimulusTrace,
	type TrialStimulus,
	totalTrials,
} from "./_types";

export function generateStimuli(
	spec: SessionSpec,
	rng: RandomSource,
): StimulusTrace {
	const total = totalTrials(spec);
	// per-mod drawn history, by trial, for t-N lookback
	const history = new Map<ModID, Option[]>();
	for (const mc of spec.mods) {
		history.set(mc.mod, []);
	}

	const trace: TrialStimulus[] = [];
	for (let t = 0; t < total; t++) {
		const values: ModStimulus[] = [];
		for (const mc of spec.mods) {
			const opts = mc.options;
			const past = history.get(mc.mod)!;

			let value: Option;
			if (t < spec.n) {
				value = opts[rng.intn(opts.length)]!;
			} else {
				const prev = past[t - spec.n]!;
				if (rng.float64() < spec.matchProbability) {
					value = prev;
				} else {
					// INVARIANT: options unique (k>=2) → pool non-empty.
					const pool = opts.filter((o) => o !== prev);
					value = pool[rng.intn(pool.length)]!;
				}
			}

			past.push(value);
			values.push({ mod: mc.mod, value });
		}
		trace.push({ trial: t, values });
	}

	return trace;
}
