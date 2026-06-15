import { describe, expect, test } from "bun:test";
import * as game from "@/game";
import * as driver from "@/driver";

// ---- Fake clock: deterministic time + manual scheduling ----------------

function fakeClock() {
	let t = 0;
	let seq = 0;
	const timers = new Map<number, { at: number; fn: () => void }>();

	const clock: driver.Clock = {
		now: () => t,
		schedule: (delayMs, fn) => {
			const id = seq++;
			timers.set(id, { at: t + delayMs, fn });
			return () => {
				timers.delete(id);
			};
		},
	};

	/** Advance time by `ms`, firing due timers in chronological order. */
	function advance(ms: number): void {
		const target = t + ms;
		while (true) {
			let next: { id: number; at: number; fn: () => void } | undefined;
			for (const [id, tm] of timers) {
				if (tm.at <= target && (!next || tm.at < next.at)) {
					next = { id, at: tm.at, fn: tm.fn };
				}
			}
			if (!next) break;
			timers.delete(next.id);
			t = next.at;
			next.fn();
		}
		t = target;
	}

	return { clock, advance, now: () => t, pending: () => timers.size };
}

const TIMING: game.TimingConfig = { respondingDuration: 1000, feedbackDuration: 500 };

function config(
	overrides: Partial<game.SessionConfig> = {},
): game.SessionConfig {
	return {
		n: 1,
		problemCount: 1,
		matchProbability: 0.5,
		timing: TIMING,
		mods: [{ mod: game.MOD_COLOR, options: game.CANONICAL_COLOR }],
		...overrides,
	};
}

// ---- Lifecycle ---------------------------------------------------------

describe("driver lifecycle", () => {
	test("starts idle in responding(0) with the first stimulus renderable", () => {
		const fc = fakeClock();
		const d = driver.createDriver(config(), { id: "s", seed: "k", deps: { clock: fc.clock } });
		const snap = d.getSnapshot();
		expect(snap.status).toBe("idle");
		expect(snap.phase).toBe("responding");
		expect(snap.trial).toBe(0);
		expect(snap.totalTrials).toBe(2);
		expect(snap.stimulus?.trial).toBe(0);
		expect(d.record()).toBeUndefined(); // not started yet
	});

	test("auto-advances responding -> feedback -> next trial -> done on the clock", () => {
		const fc = fakeClock();
		const d = driver.createDriver(config(), { id: "s", seed: "k", deps: { clock: fc.clock } });
		d.start();
		expect(d.getSnapshot().status).toBe("running");
		expect(d.getSnapshot().phase).toBe("responding");

		fc.advance(1000); // responding(0) window elapses
		expect(d.getSnapshot().phase).toBe("feedback");
		expect(d.getSnapshot().trial).toBe(0);

		fc.advance(500); // feedback(0) elapses -> responding(1)
		expect(d.getSnapshot().phase).toBe("responding");
		expect(d.getSnapshot().trial).toBe(1);

		fc.advance(1000); // responding(1) -> feedback(1)
		expect(d.getSnapshot().phase).toBe("feedback");

		fc.advance(500); // feedback(1) -> done (last trial)
		expect(d.getSnapshot().phase).toBe("done");
		expect(d.getSnapshot().status).toBe("done");
		expect(fc.pending()).toBe(0); // no dangling timers
		expect(d.getSnapshot().stimulus).toBeUndefined();
	});

	test("event log carries offsets relative to origin", () => {
		const fc = fakeClock();
		const d = driver.createDriver(config(), { id: "s", seed: "k", deps: { clock: fc.clock } });
		fc.advance(123); // time passes before start; origin captured at start
		d.start();
		fc.advance(1000);
		fc.advance(500);
		fc.advance(1000);
		fc.advance(500);
		const rec = d.record()!;
		expect(rec.events.length).toBeGreaterThan(0);
		// first event is closing trial 0 at offset 1000 (origin = 123)
		expect(rec.events[0]).toEqual({ type: "trialClosed", offset: 1000 });
		expect(rec.version).toBe(game.SESSION_RECORD_VERSION);
		expect(rec.stimuli.length).toBe(2);
	});
});

// ---- Inputs & feedback -------------------------------------------------

describe("driver inputs & feedback", () => {
	test("records every respond verbatim, including ignored taps during feedback", () => {
		const fc = fakeClock();
		const d = driver.createDriver(
			config({ n: 1, problemCount: 1 }),
			{ id: "s", seed: "k", deps: { clock: fc.clock } },
		);
		d.start();
		fc.advance(1000); // -> feedback(0)
		fc.advance(500); // -> responding(1) (scored)
		d.engage(game.MOD_COLOR); // accepted
		d.disengage(game.MOD_COLOR); // accepted (cancel)
		d.engage(game.MOD_COLOR); // accepted (re-press)
		fc.advance(1000); // -> feedback(1)
		d.engage(game.MOD_COLOR); // ignored: not responding (panic tap during feedback)
		const responded = d.record()!.events.filter(
			(e): e is game.Responded => e.type === "responded",
		);
		expect(responded.length).toBe(4); // 3 accepted + 1 ignored, nothing dropped
		expect(responded.filter((r) => r.result === "accepted").length).toBe(3);
		expect(responded.some((r) => r.result === "ignored" && r.reason === "notResponding")).toBe(true);
	});

	test("live feedback reflects the optimal response (correct === true)", () => {
		const fc = fakeClock();
		const d = driver.createDriver(
			config({ n: 1, problemCount: 1 }),
			{ id: "s", seed: "feedback-seed", deps: { clock: fc.clock } },
		);
		d.start();
		fc.advance(1000); // feedback(0) (memo, no feedback shown)
		expect(d.getSnapshot().feedback).toBeUndefined();
		fc.advance(500); // responding(1), scored

		// respond optimally: engage iff this trial matches t-N
		const cur = d.getSnapshot().stimulus!;
		const prevColor = stimulusColorAt(d, 0);
		const curColor = game.trialStimulusValue(cur, game.MOD_COLOR);
		if (curColor === prevColor) d.engage(game.MOD_COLOR);

		fc.advance(1000); // -> feedback(1)
		const fb = d.getSnapshot().feedback!;
		expect(fb).toBeDefined();
		expect(fb.every((f) => f.correct)).toBe(true);
		const color = fb.find((f) => f.mod === game.MOD_COLOR)!;
		expect(color.match).toBe(curColor === prevColor);
		expect(color.engaged).toBe(curColor === prevColor);
		// the richer outcome cell agrees with match/engaged
		expect(color.outcome).toBe(
			curColor === prevColor ? game.OUTCOME_HIT : game.OUTCOME_CORRECT_REJECT,
		);
	});

	test("ignores inputs before start and after done", () => {
		const fc = fakeClock();
		const d = driver.createDriver(config(), { id: "s", seed: "k", deps: { clock: fc.clock } });
		d.engage(game.MOD_COLOR); // before start -> ignored entirely (no event)
		expect(d.record()).toBeUndefined();
		d.start();
		fc.advance(3000); // run to done
		const before = d.record()!.events.length;
		d.engage(game.MOD_COLOR); // after done -> no-op
		expect(d.record()!.events.length).toBe(before);
	});
});

// helper: read trial t's color from the driver's (running) record stimuli
function stimulusColorAt(d: driver.SessionDriver, t: number): game.Option | undefined {
	const rec = d.record();
	return rec ? game.trialStimulusValue(rec.stimuli[t]!, game.MOD_COLOR) : undefined;
}

// ---- Determinism & abort ----------------------------------------------

describe("driver determinism & abort", () => {
	test("same seed + same scripted timeline -> identical records", () => {
		function run(): game.SessionRecord {
			const fc = fakeClock();
			const d = driver.createDriver(
				config({ n: 1, problemCount: 2 }),
				{ id: "s", seed: "same-seed", deps: { clock: fc.clock } },
			);
			d.start();
			fc.advance(1000);
			fc.advance(500);
			d.engage(game.MOD_COLOR);
			fc.advance(1000);
			fc.advance(500);
			fc.advance(1000);
			fc.advance(500);
			return d.record()!;
		}
		expect(run()).toEqual(run());
	});

	test("abort stops the clock and freezes the log", () => {
		const fc = fakeClock();
		const d = driver.createDriver(
			config({ n: 1, problemCount: 5 }),
			{ id: "s", seed: "k", deps: { clock: fc.clock } },
		);
		d.start();
		fc.advance(1000); // feedback(0)
		d.abort();
		expect(d.getSnapshot().status).toBe("aborted");
		expect(fc.pending()).toBe(0); // timer cancelled
		const frozen = d.record()!.events.length;
		fc.advance(10000); // no further transitions
		expect(d.record()!.events.length).toBe(frozen);
	});

	test("notifies subscribers on change and stops after unsubscribe", () => {
		const fc = fakeClock();
		const d = driver.createDriver(config(), { id: "s", seed: "k", deps: { clock: fc.clock } });
		let count = 0;
		const unsub = d.subscribe(() => {
			count++;
		});
		d.start(); // 1 notification
		fc.advance(1000); // 1 notification (close)
		expect(count).toBeGreaterThanOrEqual(2);
		const at = count;
		unsub();
		fc.advance(500); // no more notifications
		expect(count).toBe(at);
	});

	test("record() returns an immutable snapshot, decoupled from the live log", () => {
		const fc = fakeClock();
		const d = driver.createDriver(
			config({ n: 1, problemCount: 5 }),
			{ id: "s", seed: "k", deps: { clock: fc.clock } },
		);
		d.start();
		fc.advance(1000); // feedback(0): a trialClosed is appended to the live log
		const captured = d.record()!;
		const lenAtCapture = captured.events.length;
		expect(lenAtCapture).toBeGreaterThan(0);
		fc.advance(500); // session keeps advancing, pushing more events to the live log
		fc.advance(1000);
		// the previously-captured record must NOT have grown (no aliasing)
		expect(captured.events.length).toBe(lenAtCapture);
		// a freshly-taken record reflects the newer events
		expect(d.record()!.events.length).toBeGreaterThan(lenAtCapture);
	});
});
