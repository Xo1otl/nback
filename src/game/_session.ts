/**
 * The pure, deterministic session state machine (§States, §Events).
 *
 * No clock, no timers, no I/O: a driver dispatches each event with an absolute
 * `offset` (ms from Origin) and threads the returned {@link SessionState}.
 * The emitted events are the append-only log stored in a `SessionRecord`.
 *
 * INVARIANT: transitions ({@link closeTrial}, {@link nextTrial}) are total — out-of-phase returns event with state unchanged (no-op), never throws.
 */

import { generateStimuli } from "./_stimuli";
import { validateAndResolveConfig } from "./_spec";
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
	specMod,
	totalTrials,
} from "./_types";

export type StartedSession = {
	readonly spec: SessionSpec;
	readonly stimuli: StimulusTrace;
	readonly state: SessionState;
};

/**
 * Validate the config, generate the stimulus trace, and return the initial
 * state responding(0) with onset 0 (§Timing). Throws {@link ConfigError} on an
 * invalid config.
 */
export function startSession(
	cfg: SessionConfig,
	rng: RandomSource,
): StartedSession {
	const spec = validateAndResolveConfig(cfg);
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

/**
 * Validate response → {@link Responded} event + next state (§Events). Accepted response folds into state.responses (last accepted per mod wins); non-accepted leaves state unchanged. Result/reason precedence: phase → scored → mod → window (see classifyResponse).
 */
export function respond(
	spec: SessionSpec,
	state: SessionState,
	mod: ModID,
	action: ResponseAction,
	offset: Milliseconds,
): RespondResult {
	const event = classifyResponse(spec, state, mod, action, offset);
	if (event.result !== "accepted") {
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
		return { ...base, result: "ignored", reason: "notResponding" };
	}
	if (state.trial < spec.n) {
		return { ...base, result: "ignored", reason: "memoTrial" };
	}
	if (specMod(spec, mod) === undefined) {
		return { ...base, result: "rejected", reason: "modNotEnabled" };
	}
	const elapsed = offset - state.respondingOnset;
	if (elapsed < 0 || elapsed > spec.timing.respondingDuration) {
		return { ...base, result: "rejected", reason: "outsideWindow" };
	}
	return { ...base, result: "accepted", reason: "" };
}

/** Overwrite the final action for `mod`, preserving insertion order. */
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

/**
 * feedback(t) -> responding(t+1) with respondingOnset = offset, or -> done
 * after the last trial. No-op in any other phase.
 */
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
