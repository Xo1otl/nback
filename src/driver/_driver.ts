/**
 * The session driver factory. A closure over the live mutable runtime state
 * (current {@link game.SessionState}, the event log, timers); the pure game
 * reducers do all the logic, the driver only supplies time and inputs.
 *
 * Auto-advance: on `start` it arms a responding-phase timer; when it fires it
 * calls `closeTrial` and arms a feedback-phase timer; when that fires it calls
 * `nextTrial`, then either arms the next responding timer or finishes.
 *
 * The full event log is retained verbatim — every `respond` (accepted,
 * ignored, or rejected) is appended, so behavioral analyses (RT, hesitation,
 * repeated toggles, late taps) can read the raw trace later.
 */

import * as game from "@/game";
import type {
	DriverOptions,
	ModFeedback,
	SessionDriver,
	SessionSnapshot,
	SessionStatus,
} from "./_types";

export function createDriver(
	config: game.SessionConfig,
	options: DriverOptions,
): SessionDriver {
	const { id, seed, deps } = options;
	const rng = deps.rng ?? game.newRandomSource(seed);

	// Validates config + pre-generates the stimulus trace (throws ConfigError).
	const { spec, stimuli, state: initial } = game.startSession(config, rng);

	let state = initial;
	let status: SessionStatus = "idle";
	let origin: game.VSyncStamp = 0;
	const events: game.Event[] = [];

	let cancelTimer: (() => void) | undefined;
	const listeners = new Set<() => void>();
	let snapshot = buildSnapshot();

	function offset(): game.Milliseconds {
		return deps.clock.now() - origin;
	}

	function clearTimer(): void {
		cancelTimer?.();
		cancelTimer = undefined;
	}

	function emit(): void {
		snapshot = buildSnapshot();
		for (const listener of listeners) {
			listener();
		}
	}

	function armResponding(): void {
		clearTimer();
		cancelTimer = deps.clock.schedule(spec.timing.respondingDuration, onCloseTimer);
	}

	function armFeedback(): void {
		clearTimer();
		cancelTimer = deps.clock.schedule(spec.timing.feedbackDuration, onNextTimer);
	}

	function onCloseTimer(): void {
		const closed = game.closeTrial(state, offset());
		state = closed.state;
		events.push(closed.event);
		armFeedback();
		emit();
	}

	function onNextTimer(): void {
		const advanced = game.nextTrial(spec, state, offset());
		state = advanced.state;
		events.push(advanced.event);
		if (state.phase === "done") {
			clearTimer();
			status = "done";
		} else {
			armResponding();
		}
		emit();
	}

	function respondCmd(mod: game.ModID, action: game.ResponseAction): void {
		if (status !== "running") return;
		const responded = game.respond(spec, state, mod, action, offset());
		state = responded.state;
		events.push(responded.event); // keep the full trace, incl. ignored/rejected
		emit();
	}

	function buildFeedback(): ModFeedback[] {
		return spec.mods.map((mc) => {
			const match = game.matchAt(stimuli, spec.n, state.trial, mc.mod) ?? false;
			const engaged = game.isEngaged(state, mc.mod);
			const outcome = game.outcomeOf(match, engaged);
			return {
				mod: mc.mod,
				match,
				engaged,
				correct: game.outcomeIsCorrect(outcome),
				outcome,
			};
		});
	}

	function buildSnapshot(): SessionSnapshot {
		const scored = game.isScoredTrial(spec, state.trial);
		const stimulus =
			state.phase === "done"
				? undefined
				: stimuli.find((s) => s.trial === state.trial);
		const feedback =
			state.phase === "feedback" && scored ? buildFeedback() : undefined;
		return {
			status,
			phase: state.phase,
			trial: state.trial,
			totalTrials: game.totalTrials(spec),
			scored,
			stimulus,
			responses: state.responses,
			feedback,
		};
	}

	return {
		getSnapshot: () => snapshot,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		start() {
			if (status !== "idle") return;
			origin = deps.clock.now();
			status = "running";
			armResponding();
			emit();
		},
		engage(mod) {
			respondCmd(mod, game.ACTION_ENGAGE);
		},
		disengage(mod) {
			respondCmd(mod, game.ACTION_DISENGAGE);
		},
		abort() {
			if (status === "done" || status === "aborted") return;
			clearTimer();
			status = "aborted";
			emit();
		},
		record() {
			if (status === "idle") return undefined;
			return game.newSessionRecord(id, spec, seed, stimuli, origin, events);
		},
	};
}
