/** Game data model. INVARIANT: no clock/timers; driver supplies offsets (§Timing). § refs → specs.md. */

export type SessionID = string;
export type TrialIndex = number;
/** Milliseconds from Origin (§Timing). */
export type Milliseconds = number;
/** Wall-clock epoch ms. */
export type Timestamp = number;
export type Probability = number;
/** Modality option value; stable ID, compared by equality. */
export type Option = string;
export type RandomSeed = string;
/** Modality id; open set (known: MOD_*). */
export type ModID = string;

export type OptionList = readonly Option[];

export type ResponseAction = "engage" | "disengage";
export const ACTION_ENGAGE: ResponseAction = "engage";
export const ACTION_DISENGAGE: ResponseAction = "disengage";

export type EventResult = "accepted" | "ignored" | "rejected";

export type ReasonCode =
	| ""
	| "notResponding"
	| "memoTrial"
	| "modNotEnabled"
	| "outsideWindow";

/** Single result↔reason mapping; accepted ⇔ reason === "". Events persist reason only. */
export function resultOf(reason: ReasonCode): EventResult {
	switch (reason) {
		case "":
			return "accepted";
		case "notResponding":
		case "memoTrial":
			return "ignored";
		case "modNotEnabled":
		case "outsideWindow":
			return "rejected";
	}
}

export type Phase = "responding" | "feedback" | "done";

export type TimingConfig = {
	/** Bounds valid respond offset (§Events). */
	readonly respondingDuration: Milliseconds;
	/** Driver-only feedback display duration. */
	readonly feedbackDuration: Milliseconds;
};

export type ModConfig = {
	readonly mod: ModID;
	/** Enabled option set O_m; |O_m| >= 2 (§Modalities). */
	readonly options: OptionList;
};

/** Raw, unvalidated input. */
export type SessionConfig = {
	readonly n: number;
	readonly problemCount: number;
	readonly matchProbability: Probability;
	readonly timing: TimingConfig;
	readonly mods: readonly ModConfig[];
};

/** Validated, resolved: §Configuration invariants hold, options materialized. */
export type SessionSpec = {
	readonly n: number;
	readonly problemCount: number;
	readonly matchProbability: Probability;
	readonly timing: TimingConfig;
	readonly mods: readonly ModConfig[];
};

export type ModStimulus = {
	readonly mod: ModID;
	readonly value: Option;
};

export type TrialStimulus = {
	readonly trial: TrialIndex;
	readonly values: readonly ModStimulus[];
};

/** Pre-generated sequence; length = totalTrials, indexed by trial. */
export type StimulusTrace = readonly TrialStimulus[];

export type ModResponse = {
	readonly mod: ModID;
	readonly action: ResponseAction;
};

export type SessionState = {
	readonly phase: Phase;
	readonly trial: TrialIndex;
	/** Current responding onset; 0 at t=0, else nextTrial offset. */
	readonly respondingOnset: Milliseconds;
	/** Current-trial final action per mod; last accepted wins; absent→disengaged; reset on nextTrial. INVARIANT: event log is SSOT, this is its incremental view. */
	readonly responses: readonly ModResponse[];
};

export type Responded = {
	readonly type: "responded";
	readonly offset: Milliseconds;
	readonly mod: ModID;
	readonly action: ResponseAction;
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

export const SESSION_RECORD_VERSION = 5;

/** SSOT for a play-through; analysis package is a pure projection over it (§intro). */
export type SessionRecord = {
	readonly version: number;
	readonly id: SessionID;
	readonly spec: SessionSpec;
	readonly seed: RandomSeed;
	readonly stimuli: StimulusTrace;
	/** Wall-clock epoch ms at responding(0) onset; event offsets relative → createdAt + offset ≈ event wall time. */
	readonly createdAt: Timestamp;
	readonly events: readonly Event[];
};

export function newSessionRecord(
	id: SessionID,
	spec: SessionSpec,
	seed: RandomSeed,
	stimuli: StimulusTrace,
	createdAt: Timestamp,
	events: readonly Event[],
): SessionRecord {
	return {
		version: SESSION_RECORD_VERSION,
		id,
		spec,
		seed,
		// HAZARD: copy; driver keeps mutating live log after record() returns.
		stimuli: [...stimuli],
		createdAt,
		events: [...events],
	};
}

/** float64→[0,1), intn(n)→[0,n). Seedable impl: {@link newRandomSource}. */
export interface RandomSource {
	float64(): number;
	intn(n: number): number;
}

/** Total trials T = N + problemCount (§Trials). */
export function totalTrials(spec: SessionSpec): number {
	return spec.n + spec.problemCount;
}

/** Scored trial: t >= N (§Trials). */
export function isScoredTrial(spec: SessionSpec, t: TrialIndex): boolean {
	return t >= spec.n && t < totalTrials(spec);
}

export function specMod(spec: SessionSpec, mod: ModID): ModConfig | undefined {
	return spec.mods.find((m) => m.mod === mod);
}

export function trialStimulusValue(
	t: TrialStimulus,
	mod: ModID,
): Option | undefined {
	return t.values.find((v) => v.mod === mod)?.value;
}

/** Final accepted action for mod; default disengage. */
export function responseFor(state: SessionState, mod: ModID): ResponseAction {
	return state.responses.find((r) => r.mod === mod)?.action ?? ACTION_DISENGAGE;
}

/** SYNC: shared by SessionState + driver SessionSnapshot. */
export function engagedIn(responses: readonly ModResponse[], mod: ModID): boolean {
	return responses.find((r) => r.mod === mod)?.action === ACTION_ENGAGE;
}

export function isEngaged(state: SessionState, mod: ModID): boolean {
	return engagedIn(state.responses, mod);
}

// SYNC: driver feedback + analysis projection both consume these.

/** SDT confusion-matrix cells. */
export type Outcome = "H" | "M" | "F" | "C";
/** Hit: match + engaged. */
export const OUTCOME_HIT: Outcome = "H";
/** Miss: match + disengaged. */
export const OUTCOME_MISS: Outcome = "M";
/** False alarm: no match + engaged. */
export const OUTCOME_FALSE_ALARM: Outcome = "F";
/** Correct reject: no match + disengaged. */
export const OUTCOME_CORRECT_REJECT: Outcome = "C";

export function outcomeOf(matched: boolean, engaged: boolean): Outcome {
	if (matched) {
		return engaged ? OUTCOME_HIT : OUTCOME_MISS;
	}
	return engaged ? OUTCOME_FALSE_ALARM : OUTCOME_CORRECT_REJECT;
}

export function outcomeIsMatch(o: Outcome): boolean {
	return o === OUTCOME_HIT || o === OUTCOME_MISS;
}

export function outcomeIsEngaged(o: Outcome): boolean {
	return o === OUTCOME_HIT || o === OUTCOME_FALSE_ALARM;
}

export function outcomeIsCorrect(o: Outcome): boolean {
	return o === OUTCOME_HIT || o === OUTCOME_CORRECT_REJECT;
}

/** Match rule (§Match): mod at t repeats t-n value (stable-ID eq). undefined on memo trial (t<n) or absent trial/value. */
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

/** Replay responded events → final engaged for `mod` (last accepted wins; default disengaged). SYNC: must agree with live fold {@link isEngaged}. */
export function finalEngagedFrom(
	responded: readonly Responded[],
	mod: ModID,
): boolean {
	let engaged = false;
	for (const r of responded) {
		if (r.mod === mod && resultOf(r.reason) === "accepted") {
			engaged = r.action === ACTION_ENGAGE;
		}
	}
	return engaged;
}

/** Trials that reached feedback (`trialClosed` logged), replayed from the event log. SYNC: analysis's segmentation must agree. */
export function closedTrials(events: readonly Event[]): ReadonlySet<TrialIndex> {
	const closed = new Set<TrialIndex>();
	let trial = 0;
	for (const ev of events) {
		if (ev.type === "trialClosed") {
			closed.add(trial);
		} else if (ev.type === "trialAdvanced") {
			trial++;
		}
	}
	return closed;
}

/** Actual scored trials played, vs. configured {@link SessionSpec.problemCount}. */
export function playedProblemCount(record: SessionRecord): number {
	let count = 0;
	for (const t of closedTrials(record.events)) {
		if (isScoredTrial(record.spec, t)) {
			count++;
		}
	}
	return count;
}

/** All configured trials closed; false ⇒ aborted early. No persisted status field — derived from the event log (SSOT). */
export function isComplete(record: SessionRecord): boolean {
	return closedTrials(record.events).size >= totalTrials(record.spec);
}

export const MOD_POSITION: ModID = "position";
export const MOD_COLOR: ModID = "color";
export const MOD_CHARACTER: ModID = "character";
export const MOD_SHAPE: ModID = "shape";
export const MOD_AUDIO: ModID = "audio";
export const MOD_ANIMATION: ModID = "animation";

export const COLOR_RED: Option = "red";
export const COLOR_GREEN: Option = "green";
export const COLOR_PURPLE: Option = "purple";
export const COLOR_BLUE: Option = "blue";

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
	COLOR_BLUE,
];

export const CANONICAL_CHARACTER: OptionList = [
	"0",
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"A",
	"B",
	"C",
	"D",
	"E",
	"H",
	"K",
	"L",
	"M",
	"O",
];

export const CANONICAL_SHAPE: OptionList = [
	SHAPE_TRIANGLE,
	SHAPE_SQUARE,
	SHAPE_PENTAGON,
	SHAPE_ELLIPSE,
];

export const CANONICAL_AUDIO: OptionList = [
	"A",
	"B",
	"C",
	"H",
	"K",
	"L",
	"M",
	"O",
];

export const CANONICAL_ANIMATION: OptionList = [
	ANIMATION_BLUR,
	ANIMATION_FLYING,
	ANIMATION_SCALING,
	ANIMATION_ROTATION,
	ANIMATION_NONE,
];

/** Validate enabled subsets (§Configuration). position intentionally absent: coords grid-dependent/free-form, only generic k>=2/uniqueness apply. */
export const CANONICAL_OPTIONS: Readonly<Record<ModID, OptionList>> = {
	[MOD_COLOR]: CANONICAL_COLOR,
	[MOD_CHARACTER]: CANONICAL_CHARACTER,
	[MOD_SHAPE]: CANONICAL_SHAPE,
	[MOD_AUDIO]: CANONICAL_AUDIO,
	[MOD_ANIMATION]: CANONICAL_ANIMATION,
};
