/**
 * Data model for the multiplex n-back game (port of `contract-go/game`).
 *
 * This package is pure TypeScript and UI-framework-agnostic: it holds no
 * timers and never reads the clock (§Timing) — a driver dispatches events and
 * supplies offsets. Data are plain immutable values; behavior lives in
 * module-level functions (see `_spec`, `_stimuli`, `_session`).
 *
 * Section references (§) point to `contract-go/game/specs.md`.
 */

// ---- Scalar aliases (spec-level distinctions; structurally plain) ----

export type SessionID = string;
export type TrialIndex = number;
/** Milliseconds from Origin (§Timing). */
export type Milliseconds = number;
/** Absolute v-sync timestamp; only `origin` is stored, the sole absolute ref. */
export type VSyncStamp = number;
export type Probability = number;
/** A modality option value (stable ID, compared by equality). */
export type Option = string;
export type RandomSeed = string;
/** Modality identifier (open set; known mods listed as `MOD_*`). */
export type ModID = string;

export type OptionList = readonly Option[];

// ---- Closed enumerations (string-literal unions + named constants) ----

export type ResponseAction = "engage" | "disengage";
export const ACTION_ENGAGE: ResponseAction = "engage";
export const ACTION_DISENGAGE: ResponseAction = "disengage";

export type EventResult = "accepted" | "ignored" | "rejected";
export const RESULT_ACCEPTED: EventResult = "accepted";
export const RESULT_IGNORED: EventResult = "ignored";
export const RESULT_REJECTED: EventResult = "rejected";

export type ReasonCode =
	| ""
	| "notResponding"
	| "memoTrial"
	| "modNotEnabled"
	| "outsideWindow";
export const REASON_NONE: ReasonCode = "";
export const REASON_NOT_RESPONDING: ReasonCode = "notResponding";
export const REASON_MEMO_TRIAL: ReasonCode = "memoTrial";
export const REASON_MOD_NOT_ENABLED: ReasonCode = "modNotEnabled";
export const REASON_OUTSIDE_WINDOW: ReasonCode = "outsideWindow";

export type Phase = "responding" | "feedback" | "done";
export const PHASE_RESPONDING: Phase = "responding";
export const PHASE_FEEDBACK: Phase = "feedback";
export const PHASE_DONE: Phase = "done";

// ---- Configuration & resolved spec (§Configuration) ----

export type TimingConfig = {
	/** Driver-facing window length; bounds the valid `respond` offset (§Events). */
	readonly respondingDuration: Milliseconds;
	/** Driver-only display duration of the feedback phase. */
	readonly feedbackDuration: Milliseconds;
};

export type ModConfig = {
	readonly mod: ModID;
	/** Enabled option set O_m; |O_m| >= 2 (§Modalities). */
	readonly options: OptionList;
};

/** Raw, unvalidated input to {@link startSession}. */
export type SessionConfig = {
	readonly n: number;
	readonly problemCount: number;
	readonly matchProbability: Probability;
	readonly timing: TimingConfig;
	readonly mods: readonly ModConfig[];
};

/**
 * Validated, resolved session parameters. Same shape as {@link SessionConfig}
 * but every invariant in §Configuration holds and every mod's options are
 * materialized (canonical defaults filled in).
 */
export type SessionSpec = {
	readonly n: number;
	readonly problemCount: number;
	readonly matchProbability: Probability;
	readonly timing: TimingConfig;
	readonly mods: readonly ModConfig[];
};

// ---- Stimuli (§Generation) ----

export type ModStimulus = {
	readonly mod: ModID;
	readonly value: Option;
};

export type TrialStimulus = {
	readonly trial: TrialIndex;
	readonly values: readonly ModStimulus[];
};

/** The full pre-generated stimulus sequence; length = totalTrials, by trial. */
export type StimulusTrace = readonly TrialStimulus[];

// ---- Session state machine (§States) ----

export type ModResponse = {
	readonly mod: ModID;
	readonly action: ResponseAction;
};

export type SessionState = {
	readonly phase: Phase;
	readonly trial: TrialIndex;
	/** Offset of the current responding-phase onset (0 at t=0, else nextTrial offset). */
	readonly respondingOnset: Milliseconds;
	/**
	 * Final accepted response action per modality for the CURRENT trial — the
	 * fold that live feedback needs (last accepted action wins; a modality absent
	 * here is disengaged). Reset on entering the next trial. The append-only
	 * event log remains the SSOT; this is its current-trial view, maintained
	 * incrementally so drivers never replay the log to render feedback.
	 */
	readonly responses: readonly ModResponse[];
};

// ---- Events (§Events) — a clean discriminated union ----
//
// `contract-go` types these as `any`; here each event carries a `type`
// discriminant so the log is a fully-typed `Event[]`.

export type Responded = {
	readonly type: "responded";
	readonly offset: Milliseconds;
	readonly mod: ModID;
	readonly action: ResponseAction;
	readonly result: EventResult;
	readonly reason: ReasonCode;
};

export type TrialClosed = {
	readonly type: "trialClosed";
	readonly offset: Milliseconds;
};

export type TrialAdvanced = {
	readonly type: "trialAdvanced";
	readonly offset: Milliseconds;
};

export type Event = Responded | TrialClosed | TrialAdvanced;

// ---- Session record (SSOT originator, §intro) ----

export const SESSION_RECORD_VERSION = 3;

/**
 * The single source of truth for a play-through: everything needed for
 * arbitrary post-hoc analysis, reconstruction, and projection (§intro). The
 * `analysis` package is a pure projection over this value.
 */
export type SessionRecord = {
	readonly version: number;
	readonly id: SessionID;
	readonly spec: SessionSpec;
	readonly seed: RandomSeed;
	readonly stimuli: StimulusTrace;
	/** Absolute v-sync at responding(0) onset; `absVSync = origin + offset`. */
	readonly origin: VSyncStamp;
	readonly events: readonly Event[];
};

export function newSessionRecord(
	id: SessionID,
	spec: SessionSpec,
	seed: RandomSeed,
	stimuli: StimulusTrace,
	origin: VSyncStamp,
	events: readonly Event[],
): SessionRecord {
	return {
		version: SESSION_RECORD_VERSION,
		id,
		spec,
		seed,
		// Copy the arrays so the record is a true immutable snapshot, decoupled
		// from any live mutable producer (e.g. the driver's growing event log,
		// which it keeps pushing to after `record()` hands out a SessionRecord).
		stimuli: [...stimuli],
		origin,
		events: [...events],
	};
}

// ---- Randomness (§Generation) ----

/**
 * Source of randomness for stimulus generation. Mirrors Go's `RandomSource`:
 * `float64()` in [0, 1), `intn(n)` a uniform integer in [0, n).
 * See {@link newRandomSource} in `_rng` for a seedable implementation.
 */
export interface RandomSource {
	float64(): number;
	intn(n: number): number;
}

// ---- Derived helpers (Go receivers -> functions) ----

/** Total trials T = N + problemCount (§Trials). */
export function totalTrials(spec: SessionSpec): number {
	return spec.n + spec.problemCount;
}

/** Whether trial `t` is scored (t >= N) rather than a memorization trial (§Trials). */
export function isScoredTrial(spec: SessionSpec, t: TrialIndex): boolean {
	return t >= spec.n && t < totalTrials(spec);
}

/** Look up a modality's resolved config, or `undefined` if not enabled. */
export function specMod(spec: SessionSpec, id: ModID): ModConfig | undefined {
	return spec.mods.find((m) => m.mod === id);
}

/** A trial stimulus's value for one modality, or `undefined` if absent. */
export function trialStimulusValue(
	t: TrialStimulus,
	id: ModID,
): Option | undefined {
	return t.values.find((v) => v.mod === id)?.value;
}

/** Stable-ID equality of two modality stimuli (§Modalities, Match). */
export function sameStimulus(a: ModStimulus, b: ModStimulus): boolean {
	return a.mod === b.mod && a.value === b.value;
}

/** The current trial's final accepted action for a modality (default disengage). */
export function responseFor(state: SessionState, id: ModID): ResponseAction {
	return state.responses.find((r) => r.mod === id)?.action ?? ACTION_DISENGAGE;
}

/** Whether a modality is currently engaged in the current trial. */
export function isEngaged(state: SessionState, id: ModID): boolean {
	return responseFor(state, id) === ACTION_ENGAGE;
}

// ---- Scoring vocabulary (§Scoring) ----
//
// The single home for the three rules that define a scored trial: the match
// rule, the response fold, and the match×engaged confusion-matrix cell. Both
// the live `driver` feedback and the post-hoc `analysis` projection consume
// these, so the two views can never drift.

/** The SDT confusion-matrix cells. */
export type Outcome = "H" | "M" | "F" | "C";
/** Hit: match + engaged. */
export const OUTCOME_HIT: Outcome = "H";
/** Miss: match + disengaged. */
export const OUTCOME_MISS: Outcome = "M";
/** False alarm: no match + engaged. */
export const OUTCOME_FALSE_ALARM: Outcome = "F";
/** Correct reject: no match + disengaged. */
export const OUTCOME_CORRECT_REJECT: Outcome = "C";

/** Classify a scored trial from whether it matched and whether it was engaged. */
export function outcomeOf(matched: boolean, engaged: boolean): Outcome {
	if (matched) {
		return engaged ? OUTCOME_HIT : OUTCOME_MISS;
	}
	return engaged ? OUTCOME_FALSE_ALARM : OUTCOME_CORRECT_REJECT;
}

/** Whether the trial was a match (Hit or Miss). */
export function outcomeIsMatch(o: Outcome): boolean {
	return o === OUTCOME_HIT || o === OUTCOME_MISS;
}

/** Whether the final response state was engaged (Hit or FalseAlarm). */
export function outcomeIsEngaged(o: Outcome): boolean {
	return o === OUTCOME_HIT || o === OUTCOME_FALSE_ALARM;
}

/** Whether the response was correct (Hit or CorrectReject). */
export function outcomeIsCorrect(o: Outcome): boolean {
	return o === OUTCOME_HIT || o === OUTCOME_CORRECT_REJECT;
}

/**
 * The match rule (§Match): whether modality `mod` at trial `t` repeats its value
 * from the n-back lookback `t - n` (stable-ID equality). `undefined` when `t` is
 * a memorization trial (`t < n`) or either trial/value is absent — the trace is
 * dense by trial, so for a well-formed record this resolves for every scored t.
 */
export function matchAt(
	stimuli: StimulusTrace,
	n: number,
	t: TrialIndex,
	mod: ModID,
): boolean | undefined {
	if (t < n) {
		return undefined;
	}
	const cur = stimuli[t];
	const prev = stimuli[t - n];
	if (cur === undefined || prev === undefined) {
		return undefined;
	}
	const curValue = trialStimulusValue(cur, mod);
	const prevValue = trialStimulusValue(prev, mod);
	if (curValue === undefined || prevValue === undefined) {
		return undefined;
	}
	return curValue === prevValue;
}

/**
 * Replay a trial's `responded` events into the final engaged state for `mod`
 * (last accepted action wins; default disengaged). This is the log-replay
 * equivalent of the live incremental fold read via {@link responseFor} /
 * {@link isEngaged}; both implement the same §Scoring rule over the SSOT.
 */
export function finalEngagedFrom(
	responded: readonly Responded[],
	mod: ModID,
): boolean {
	let engaged = false;
	for (const r of responded) {
		if (r.mod === mod && r.result === RESULT_ACCEPTED) {
			engaged = r.action === ACTION_ENGAGE;
		}
	}
	return engaged;
}

// ---- Known modalities and their canonical option universes (§Modalities) ----

export const MOD_POSITION: ModID = "position";
export const MOD_COLOR: ModID = "color";
export const MOD_CHARACTER: ModID = "character";
export const MOD_SHAPE: ModID = "shape";
export const MOD_AUDIO: ModID = "audio";
export const MOD_ANIMATION: ModID = "animation";

export const COLOR_RED: Option = "red";
export const COLOR_GREEN: Option = "green";
export const COLOR_PURPLE: Option = "purple";
export const COLOR_BLACK: Option = "black";

export const SHAPE_TRIANGLE: Option = "triangle";
export const SHAPE_SQUARE: Option = "square";
export const SHAPE_PENTAGON: Option = "pentagon";
export const SHAPE_ELLIPSE: Option = "ellipse";

export const ANIMATION_BLUR: Option = "blur";
export const ANIMATION_FLYING: Option = "flying";
export const ANIMATION_SCALING: Option = "scaling";
export const ANIMATION_ROTATION: Option = "rotation";
export const ANIMATION_NONE: Option = "none";

export const CANONICAL_COLOR: OptionList = [
	COLOR_RED,
	COLOR_GREEN,
	COLOR_PURPLE,
	COLOR_BLACK,
];

export const CANONICAL_CHARACTER: OptionList = [
	"0", "1", "2", "3", "4",
	"5", "6", "7", "8", "9",
	"A", "B", "C", "D", "E",
	"H", "K", "L", "M", "O",
];

export const CANONICAL_SHAPE: OptionList = [
	SHAPE_TRIANGLE,
	SHAPE_SQUARE,
	SHAPE_PENTAGON,
	SHAPE_ELLIPSE,
];

export const CANONICAL_AUDIO: OptionList = [
	"A", "B", "C", "H",
	"K", "L", "M", "O",
];

export const CANONICAL_ANIMATION: OptionList = [
	ANIMATION_BLUR,
	ANIMATION_FLYING,
	ANIMATION_SCALING,
	ANIMATION_ROTATION,
	ANIMATION_NONE,
];

/**
 * Canonical universes used to validate enabled subsets (§Configuration).
 * `position` is intentionally absent: its coordinate IDs are grid-dependent
 * and free-form, so only the generic k >= 2 / uniqueness rules apply.
 */
export const CANONICAL_OPTIONS: Readonly<Record<ModID, OptionList>> = {
	[MOD_COLOR]: CANONICAL_COLOR,
	[MOD_CHARACTER]: CANONICAL_CHARACTER,
	[MOD_SHAPE]: CANONICAL_SHAPE,
	[MOD_AUDIO]: CANONICAL_AUDIO,
	[MOD_ANIMATION]: CANONICAL_ANIMATION,
};
