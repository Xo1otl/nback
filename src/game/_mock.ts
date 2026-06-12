/**
 * Script-driven mock session for steps 2–3 of the build procedure: real phase
 * transitions and toggle bookkeeping (the contract semantics under test), but
 * canned stimuli, canned match states, and canned kappas — no generation, no
 * n-back comparison, no kappa math.
 */

import type {
	Judgment,
	Modality,
	PerModality,
	Session,
	Settings,
	Snapshot,
	Stimulus,
	Tally,
} from "./_contract";

export type MockScript = {
	/** Full stimulus sequence; length must equal n + problemCount. */
	readonly sequence: readonly Stimulus[];
	/**
	 * matches[i] is the actual per-modality match state of scored trial
	 * n + i. When reusing a test script against the real implementation,
	 * keep it consistent with `sequence` (stimulus equal to the one n back).
	 */
	readonly matches: readonly PerModality<boolean>[];
	/** Canned kappas exposed in every snapshot; defaults to 0 per modality. */
	readonly kappas?: PerModality<number>;
};

const EMPTY_TALLY: Tally = {
	hit: 0,
	miss: 0,
	falseAlarm: 0,
	correctRejection: 0,
};

function judge(matched: boolean, responded: boolean): Judgment {
	if (matched) {
		return responded ? "hit" : "miss";
	}
	return responded ? "falseAlarm" : "correctRejection";
}

function bump(tally: Tally, judgment: Judgment): Tally {
	return { ...tally, [judgment]: tally[judgment] + 1 };
}

export function newMockSession(
	settings: Settings,
	script: MockScript,
): Session {
	const totalTrials = settings.n + settings.problemCount;
	const enabled = settings.modalities;

	const blank = <T>(value: T): Partial<Record<Modality, T>> => {
		const out: Partial<Record<Modality, T>> = {};
		for (const m of enabled) {
			out[m] = value;
		}
		return out;
	};

	let phaseKind: "responding" | "feedback" | "done" = "responding";
	let trial = 0;
	let toggles = blank(false);
	let judgments: Partial<Record<Modality, Judgment>> | undefined;
	let tallies: Partial<Record<Modality, Tally>> = blank(EMPTY_TALLY);

	const kappas = (): PerModality<number> => script.kappas ?? blank(0);

	return {
		settings,
		totalTrials,
		sequence: script.sequence,

		snapshot(): Snapshot {
			if (phaseKind === "done") {
				return {
					phase: { kind: "done" },
					responses: blank(false),
					tallies,
					kappas: kappas(),
				};
			}
			const scoredResponding =
				phaseKind === "responding" && trial >= settings.n;
			return {
				phase: { kind: phaseKind, trial },
				stimulus: script.sequence[trial],
				responses: scoredResponding ? { ...toggles } : blank(false),
				judgments: phaseKind === "feedback" ? judgments : undefined,
				tallies,
				kappas: kappas(),
			};
		},

		respond(modality) {
			const scoredResponding =
				phaseKind === "responding" && trial >= settings.n;
			if (!scoredResponding || !enabled.includes(modality)) {
				return;
			}
			toggles = { ...toggles, [modality]: toggles[modality] !== true };
		},

		closeTrial() {
			if (phaseKind !== "responding") {
				return;
			}
			if (trial >= settings.n) {
				const match = script.matches[trial - settings.n] ?? {};
				const next: Partial<Record<Modality, Judgment>> = {};
				for (const m of enabled) {
					const j = judge(match[m] === true, toggles[m] === true);
					next[m] = j;
					tallies = { ...tallies, [m]: bump(tallies[m] ?? EMPTY_TALLY, j) };
				}
				judgments = next;
			} else {
				judgments = undefined;
			}
			phaseKind = "feedback";
		},

		nextTrial() {
			if (phaseKind !== "feedback") {
				return;
			}
			judgments = undefined;
			toggles = blank(false);
			if (trial + 1 >= totalTrials) {
				phaseKind = "done";
			} else {
				trial += 1;
				phaseKind = "responding";
			}
		},
	};
}
