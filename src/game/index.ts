/**
 * `game` — pure, UI-framework-agnostic multiplex n-back game logic.
 *
 * Port of `contract-go/game`. The public surface below is the package API;
 * import it as a namespace: `import * as game from "@/game"`.
 */

// ---- Scalars, enums, constants, and the data model ----
export {
	// scalar aliases
	type SessionID,
	type TrialIndex,
	type Milliseconds,
	type VSyncStamp,
	type Probability,
	type Option,
	type RandomSeed,
	type ModID,
	type OptionList,
	// enums + constants
	type ResponseAction,
	ACTION_ENGAGE,
	ACTION_DISENGAGE,
	type EventResult,
	RESULT_ACCEPTED,
	RESULT_IGNORED,
	RESULT_REJECTED,
	type ReasonCode,
	REASON_NONE,
	REASON_NOT_RESPONDING,
	REASON_MEMO_TRIAL,
	REASON_MOD_NOT_ENABLED,
	REASON_OUTSIDE_WINDOW,
	type Phase,
	PHASE_RESPONDING,
	PHASE_FEEDBACK,
	PHASE_DONE,
	// config + spec
	type TimingConfig,
	type ModConfig,
	type SessionConfig,
	type SessionSpec,
	// stimuli
	type ModStimulus,
	type TrialStimulus,
	type StimulusTrace,
	// state
	type SessionState,
	type ModResponse,
	// events
	type Responded,
	type TrialClosed,
	type TrialAdvanced,
	type Event,
	// record
	SESSION_RECORD_VERSION,
	type SessionRecord,
	newSessionRecord,
	// randomness
	type RandomSource,
	// derived helpers
	totalTrials,
	isScoredTrial,
	specMod,
	trialStimulusValue,
	sameStimulus,
	responseFor,
	isEngaged,
	matchAt,
	finalEngagedFrom,
	// scoring vocabulary (shared by driver feedback + analysis projection)
	type Outcome,
	OUTCOME_HIT,
	OUTCOME_MISS,
	OUTCOME_FALSE_ALARM,
	OUTCOME_CORRECT_REJECT,
	outcomeOf,
	outcomeIsMatch,
	outcomeIsEngaged,
	outcomeIsCorrect,
	// known modalities + canonical universes
	MOD_POSITION,
	MOD_COLOR,
	MOD_CHARACTER,
	MOD_SHAPE,
	MOD_AUDIO,
	MOD_ANIMATION,
	COLOR_RED,
	COLOR_GREEN,
	COLOR_PURPLE,
	COLOR_BLACK,
	SHAPE_TRIANGLE,
	SHAPE_SQUARE,
	SHAPE_PENTAGON,
	SHAPE_ELLIPSE,
	ANIMATION_BLUR,
	ANIMATION_FLYING,
	ANIMATION_SCALING,
	ANIMATION_ROTATION,
	ANIMATION_NONE,
	CANONICAL_COLOR,
	CANONICAL_CHARACTER,
	CANONICAL_SHAPE,
	CANONICAL_AUDIO,
	CANONICAL_ANIMATION,
	CANONICAL_OPTIONS,
} from "./_types";

// ---- Randomness ----
export { newRandomSource } from "./_rng";

// ---- Config validation & resolution ----
export { ConfigError, validateAndResolveConfig } from "./_spec";

// ---- Default config factory ----
export { defaultMultiplexConfig } from "./_config";

// ---- Stimulus generation ----
export { generateStimuli } from "./_stimuli";

// ---- Session state machine ----
export {
	type StartedSession,
	type RespondResult,
	type ClosedTrial,
	type AdvancedTrial,
	startSession,
	respond,
	closeTrial,
	nextTrial,
} from "./_session";
