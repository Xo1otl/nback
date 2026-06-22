/**
 * Stimulus generation (§Generation). Independent per modality and trial:
 *
 *  - t < N:  uniform from O_m.
 *  - t >= N: with probability p, copy the value at t - N (a "match");
 *            otherwise uniform from O_m \ {value at t - N} (a "non-match").
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
	// Per-mod history of drawn options, indexed by trial, for the t-N lookback.
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
