/**
 * Step-3 whole-app-flow test: confirms the overall behavior of the app by
 * composing ONLY the package mocks — script-driven game session, virtual
 * clock, recording speaker, in-memory store. The test plays the driver role
 * per §3 of src/game/specs.md: it emits closeTrial after each presentation
 * interval, nextTrial after each feedback duration, speaks the audio
 * stimulus at every responding-phase start, and injects player input as
 * timeouts at chosen virtual times.
 *
 * Tempo with presentationMs=2000, feedbackMs=800 (period 2800ms):
 *
 *   trial 0  responding [    0,  2000)  feedback [ 2000,  2800)  memorization
 *   trial 1  responding [ 2800,  4800)  feedback [ 4800,  5600)  memorization
 *   trial 2  responding [ 5600,  7600)  feedback [ 7600,  8400)  scored
 *   trial 3  responding [ 8400, 10400)  feedback [10400, 11200)  scored
 *   trial 4  responding [11200, 13200)  feedback [13200, 14000)  scored
 *   trial 5  responding [14000, 16000)  feedback [16000, 16800)  scored
 *   done at 16800
 */

import { describe, expect, test } from "bun:test";
import * as game from "@/game";
import * as hooks from "@/hooks";
import * as storage from "@/storage";

const SETTINGS: game.Settings = {
	n: 2,
	problemCount: 4,
	modalities: ["letter", "color", "audio"],
	minMatchProbability: 0,
	presentationMs: 2000,
	feedbackMs: 800,
};

/** Length n + problemCount = 6; exactly the enabled modalities per trial. */
const SEQUENCE: readonly game.Stimulus[] = [
	{ letter: "A", color: "red", audio: "A" },
	{ letter: "B", color: "green", audio: "B" },
	{ letter: "A", color: "purple", audio: "C" },
	{ letter: "C", color: "green", audio: "B" },
	{ letter: "D", color: "purple", audio: "H" },
	{ letter: "C", color: "black", audio: "B" },
];

/** matches[i][m] === (SEQUENCE[n + i][m] === SEQUENCE[i][m]); see test below. */
const MATCHES: readonly game.PerModality<boolean>[] = [
	{ letter: true, color: false, audio: false }, // trial 2 vs 0
	{ letter: false, color: true, audio: true }, // trial 3 vs 1
	{ letter: false, color: true, audio: false }, // trial 4 vs 2
	{ letter: true, color: false, audio: true }, // trial 5 vs 3
];

const KAPPAS: game.PerModality<number> = {
	letter: 0.5,
	color: -0.25,
	audio: 1,
};

const SCRIPT: game.MockScript = {
	sequence: SEQUENCE,
	matches: MATCHES,
	kappas: KAPPAS,
};

/**
 * The driver loop the real app will implement (§3): closeTrial after each
 * presentation interval, nextTrial after each feedback duration, and the
 * audio stimulus spoken at the start of every responding phase.
 */
function startDriver(
	session: game.Session,
	scheduler: hooks.Scheduler,
	speaker: hooks.Speaker,
): void {
	const onRespondingStart = () => {
		const audio = session.snapshot().stimulus?.audio;
		if (audio !== undefined) {
			speaker.speak(audio);
		}
		scheduler.setTimeout(closeTrial, session.settings.presentationMs);
	};
	const closeTrial = () => {
		session.closeTrial();
		scheduler.setTimeout(nextTrial, session.settings.feedbackMs);
	};
	const nextTrial = () => {
		session.nextTrial();
		if (session.snapshot().phase.kind === "responding") {
			onRespondingStart();
		}
	};
	onRespondingStart();
}

/** Player input, injected as timeouts at absolute virtual times (now = 0). */
function injectResponses(
	session: game.Session,
	scheduler: hooks.Scheduler,
): void {
	const respondAt = (atMs: number, modality: game.Modality) => {
		scheduler.setTimeout(() => {
			session.respond(modality);
		}, atMs);
	};
	respondAt(1000, "letter"); // memorization trial 0: no effect (§1)
	respondAt(6100, "letter"); // trial 2 @ +500ms -> hit
	respondAt(6200, "color"); // trial 2: toggle on...
	respondAt(6900, "color"); // ...then off within the trial -> no response
	respondAt(8900, "letter"); // trial 3 -> false alarm
	respondAt(9300, "audio"); // trial 3 -> hit
	respondAt(13500, "color"); // DURING feedback(4): locked, ignored (§2)
	respondAt(14400, "audio"); // trial 5 -> hit
}

function compose(): {
	session: game.Session;
	scheduler: hooks.ManualScheduler;
	speaker: hooks.RecordingSpeaker;
} {
	const session = game.newMockSession(SETTINGS, SCRIPT);
	const scheduler = hooks.newManualScheduler();
	const speaker = hooks.newRecordingSpeaker();
	injectResponses(session, scheduler);
	startDriver(session, scheduler, speaker);
	return { session, scheduler, speaker };
}

describe("script consistency", () => {
	test("matches mirror the sequence n back, per modality", () => {
		expect(SEQUENCE).toHaveLength(SETTINGS.n + SETTINGS.problemCount);
		expect(MATCHES).toHaveLength(SETTINGS.problemCount);
		for (let i = 0; i < SETTINGS.problemCount; i += 1) {
			const current = SEQUENCE[SETTINGS.n + i];
			const nBack = SEQUENCE[i];
			const match = MATCHES[i];
			expect(current).toBeDefined();
			expect(nBack).toBeDefined();
			expect(match).toBeDefined();
			for (const m of SETTINGS.modalities) {
				expect(match?.[m]).toBe(current?.[m] === nBack?.[m]);
			}
		}
	});
});

describe("whole-app flow over mocks", () => {
	test("driver tempo, judgments, response lock, and final score", () => {
		const { session, scheduler, speaker } = compose();
		const snap = () => session.snapshot();
		const advanceTo = (t: number) => {
			scheduler.advance(t - scheduler.now());
		};

		// Session starts in responding(0); trial 0's audio already spoken.
		expect(snap().phase).toEqual({ kind: "responding", trial: 0 });
		expect(snap().stimulus).toEqual(SEQUENCE[0]);
		expect(speaker.spoken).toEqual(["A"]);

		// Memorization input (respond at t=1000) has no effect.
		advanceTo(1500);
		expect(snap().phase).toEqual({ kind: "responding", trial: 0 });
		expect(snap().responses).toEqual({
			letter: false,
			color: false,
			audio: false,
		});

		// At t=2000 the first feedback begins; memorization has no judgment.
		advanceTo(1999);
		expect(snap().phase).toEqual({ kind: "responding", trial: 0 });
		advanceTo(2000);
		expect(snap().phase).toEqual({ kind: "feedback", trial: 0 });
		expect(snap().judgments).toBeUndefined();

		// At t=2800 trial 1 begins.
		advanceTo(2799);
		expect(snap().phase).toEqual({ kind: "feedback", trial: 0 });
		advanceTo(2800);
		expect(snap().phase).toEqual({ kind: "responding", trial: 1 });
		expect(snap().stimulus).toEqual(SEQUENCE[1]);

		// Trial 2 (first scored trial) begins at t=5600.
		advanceTo(5600);
		expect(snap().phase).toEqual({ kind: "responding", trial: 2 });
		expect(snap().stimulus).toEqual(SEQUENCE[2]);

		// Toggles: letter on at 6100; color on at 6200 then off at 6900.
		advanceTo(6150);
		expect(snap().responses).toEqual({
			letter: true,
			color: false,
			audio: false,
		});
		advanceTo(6500);
		expect(snap().responses).toEqual({
			letter: true,
			color: true,
			audio: false,
		});
		advanceTo(7000);
		expect(snap().responses).toEqual({
			letter: true,
			color: false,
			audio: false,
		});

		// Feedback(2): hit / toggled-off -> correctRejection / no response.
		advanceTo(7700);
		expect(snap().phase).toEqual({ kind: "feedback", trial: 2 });
		expect(snap().judgments).toEqual({
			letter: "hit",
			color: "correctRejection",
			audio: "correctRejection",
		});

		// Feedback(3): falseAlarm / miss / hit.
		advanceTo(10500);
		expect(snap().phase).toEqual({ kind: "feedback", trial: 3 });
		expect(snap().judgments).toEqual({
			letter: "falseAlarm",
			color: "miss",
			audio: "hit",
		});

		// An extra closeTrial racing into a feedback phase is absorbed (§3).
		const beforeRace = snap();
		scheduler.setTimeout(() => {
			session.closeTrial();
		}, 100); // fires at t=10600, inside feedback(3)
		advanceTo(10700);
		expect(snap()).toEqual(beforeRace);

		// Feedback(4): the color match was missed; responding during feedback
		// (respond("color") at t=13500) is locked out and changes nothing (§2).
		advanceTo(13400);
		expect(snap().phase).toEqual({ kind: "feedback", trial: 4 });
		expect(snap().judgments).toEqual({
			letter: "correctRejection",
			color: "miss",
			audio: "correctRejection",
		});
		const beforeLockedInput = snap();
		advanceTo(13600);
		expect(snap()).toEqual(beforeLockedInput);

		// Feedback(5): miss / correctRejection / hit.
		advanceTo(16100);
		expect(snap().phase).toEqual({ kind: "feedback", trial: 5 });
		expect(snap().judgments).toEqual({
			letter: "miss",
			color: "correctRejection",
			audio: "hit",
		});

		// Done after the last feedback; no timers left.
		advanceTo(16800);
		expect(snap().phase).toEqual({ kind: "done" });
		expect(scheduler.pendingCount()).toBe(0);

		// The audio option of every trial was spoken exactly once, in sequence
		// order, memorization trials included.
		expect(speaker.spoken).toEqual(["A", "B", "C", "B", "H", "B"]);
		expect(speaker.spoken).toEqual(
			SEQUENCE.flatMap((s) => (s.audio === undefined ? [] : [s.audio])),
		);

		// Final tallies: the cross of script matches x injected responses.
		expect(snap().tallies).toEqual({
			letter: { hit: 1, miss: 1, falseAlarm: 1, correctRejection: 1 },
			color: { hit: 0, miss: 2, falseAlarm: 0, correctRejection: 2 },
			audio: { hit: 2, miss: 0, falseAlarm: 0, correctRejection: 2 },
		});
		for (const m of SETTINGS.modalities) {
			const tally = snap().tallies[m];
			expect(tally).toBeDefined();
			if (tally !== undefined) {
				expect(
					tally.hit + tally.miss + tally.falseAlarm + tally.correctRejection,
				).toBe(SETTINGS.problemCount);
			}
		}
		expect(snap().kappas).toEqual(KAPPAS);
	});

	test("finished session persists and round-trips through the store", () => {
		const { session, scheduler } = compose();
		scheduler.advance(20_000);
		const final = session.snapshot();
		expect(final.phase).toEqual({ kind: "done" });

		const record: storage.SessionRecord = {
			finishedAt: 1_765_432_100_000,
			settings: SETTINGS,
			tallies: final.tallies,
			kappas: final.kappas,
		};
		const store = storage.newMemoryStore();
		store.saveSettings(SETTINGS);
		store.addRecord(record);

		expect(store.loadSettings()).toEqual(SETTINGS);
		expect(store.listRecords()).toEqual([record]);
	});

	test("identical compositions are deterministic (§3): final snapshots deep-equal", () => {
		const run = (): game.Snapshot => {
			const { session, scheduler } = compose();
			scheduler.advance(20_000);
			return session.snapshot();
		};
		const first = run();
		const second = run();
		expect(first.phase).toEqual({ kind: "done" });
		expect(second).toEqual(first);
	});
});
