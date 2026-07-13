/**
 * Pure deterministic session state machine (§States, §Events). No clock/timers/I/O: driver supplies absolute offset (ms from Origin), threads returned SessionState; emitted events = append-only log in SessionRecord.
 * INVARIANT: transitions total — out-of-phase = no-op (event, unchanged state), never throws.
 */

import { generateStimuli } from "./_stimuli";
import { ConfigError, validateAndResolveConfig } from "./_spec";
import {
	type Milliseconds,
	type ModID,
	type ModResponse,
	type RandomSource,
	type Responded,
	type ResponseAction,
	type SessionConfig,
	type SessionSpec,
	type SessionState,
	type StimulusTrace,
	type TrialAdvanced,
	type TrialClosed,
	resultOf,
	specMod,
	totalTrials,
} from "./_types";

export type StartedSession = {
	readonly spec: SessionSpec;
	readonly stimuli: StimulusTrace;
	readonly state: SessionState;
};

/** responding(0), onset 0 (§Timing). */
export function startSession(
	cfg: SessionConfig,
	rng: RandomSource,
): StartedSession | ConfigError {
	const spec = validateAndResolveConfig(cfg);
	if (spec instanceof ConfigError) {
		return spec;
	}
	const stimuli = generateStimuli(spec, rng);
	const state: SessionState = {
		phase: "responding",
		trial: 0,
		respondingOnset: 0,
		responses: [],
	};
	return { spec, stimuli, state };
}

export type RespondResult = {
	readonly event: Responded;
	readonly state: SessionState;
};

/** §Events. Accepted folds into responses (last accepted per mod wins); non-accepted → state unchanged. Precedence: phase → scored → mod → window. */
export function respond(
	spec: SessionSpec,
	state: SessionState,
	mod: ModID,
	action: ResponseAction,
	offset: Milliseconds,
): RespondResult {
	const event = classifyResponse(spec, state, mod, action, offset);
	if (resultOf(event.reason) !== "accepted") {
		return { event, state };
	}
	return {
		event,
		state: { ...state, responses: setResponse(state.responses, mod, action) },
	};
}

function classifyResponse(
	spec: SessionSpec,
	state: SessionState,
	mod: ModID,
	action: ResponseAction,
	offset: Milliseconds,
): Responded {
	const base = { type: "responded", offset, mod, action } as const;

	if (state.phase !== "responding") {
		return { ...base, reason: "notResponding" };
	}
	if (state.trial < spec.n) {
		return { ...base, reason: "memoTrial" };
	}
	if (specMod(spec, mod) === undefined) {
		return { ...base, reason: "modNotEnabled" };
	}
	const elapsed = offset - state.respondingOnset;
	if (elapsed < 0 || elapsed > spec.timing.respondingDuration) {
		return { ...base, reason: "outsideWindow" };
	}
	return { ...base, reason: "" };
}

/** Overwrite mod's action, preserve insertion order. */
function setResponse(
	responses: readonly ModResponse[],
	mod: ModID,
	action: ResponseAction,
): ModResponse[] {
	const next: ModResponse = { mod, action };
	return responses.some((r) => r.mod === mod)
		? responses.map((r) => (r.mod === mod ? next : r))
		: [...responses, next];
}

export type ClosedTrial = {
	readonly event: TrialClosed;
	readonly state: SessionState;
};

/** responding(t) -> feedback(t). No-op in any other phase. */
export function closeTrial(
	state: SessionState,
	offset: Milliseconds,
): ClosedTrial {
	const event: TrialClosed = { type: "trialClosed", offset };
	if (state.phase !== "responding") {
		return { event, state };
	}
	return { event, state: { ...state, phase: "feedback" } };
}

export type AdvancedTrial = {
	readonly event: TrialAdvanced;
	readonly state: SessionState;
};

/** feedback(t) → responding(t+1) [onset=offset], or → done after last trial. No-op otherwise. */
export function nextTrial(
	spec: SessionSpec,
	state: SessionState,
	offset: Milliseconds,
): AdvancedTrial {
	const event: TrialAdvanced = { type: "trialAdvanced", offset };
	if (state.phase !== "feedback") {
		return { event, state };
	}
	if (state.trial + 1 >= totalTrials(spec)) {
		return { event, state: { ...state, phase: "done", responses: [] } };
	}
	return {
		event,
		state: {
			phase: "responding",
			trial: state.trial + 1,
			respondingOnset: offset,
			responses: [],
		},
	};
}
