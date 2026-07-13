import { describe, expect, test } from "bun:test";
import * as game from "@/game";
import * as driver from "@/driver";

function fakeClock() {
	let t = 0;
	let seq = 0;
	const timers = new Map<number, { at: number; fn: () => void }>();

	const clock: driver.Clock = {
		now: () => t,
		epochNow: () => 1_700_000_000_000,
		schedule: (delayMs, fn) => {
			const id = seq++;
			timers.set(id, { at: t + delayMs, fn });
			return () => {
				timers.delete(id);
			};
		},
	};

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

function createDriver(
	cfg: game.SessionConfig,
	options: driver.DriverOptions,
): driver.SessionDriver {
	const d = driver.createDriver(cfg, options);
	if (d instanceof game.ConfigError) throw d;
	return d;
}

describe("driver lifecycle", () => {
	test("invalid config returns a ConfigError instead of a driver", () => {
		const fc = fakeClock();
		const d = driver.createDriver(config({ mods: [] }), {
			id: "s",
			seed: "k",
			deps: { clock: fc.clock },
		});
		expect(d).toBeInstanceOf(game.ConfigError);
	});

	test("starts idle in responding(0) with the first stimulus renderable", () => {
		const fc = fakeClock();
		const d = createDriver(config(), { id: "s", seed: "k", deps: { clock: fc.clock } });
		const snap = d.getSnapshot();
		expect(snap.status).toBe("idle");
		expect(snap.phase).toBe("responding");
		expect(snap.trial).toBe(0);
		expect(snap.totalTrials).toBe(2);
		expect(snap.stimulus?.trial).toBe(0);
		expect(d.record()).toBeUndefined();
	});

	test("auto-advances responding -> feedback -> next trial -> done on the clock", () => {
		const fc = fakeClock();
		const d = createDriver(config(), { id: "s", seed: "k", deps: { clock: fc.clock } });
		d.start();
		expect(d.getSnapshot().status).toBe("running");
		expect(d.getSnapshot().phase).toBe("responding");

		fc.advance(1000);
		expect(d.getSnapshot().phase).toBe("feedback");
		expect(d.getSnapshot().trial).toBe(0);

		fc.advance(500);
		expect(d.getSnapshot().phase).toBe("responding");
		expect(d.getSnapshot().trial).toBe(1);

		fc.advance(1000);
		expect(d.getSnapshot().phase).toBe("feedback");

		fc.advance(500);
		expect(d.getSnapshot().phase).toBe("done");
		expect(d.getSnapshot().status).toBe("done");
		expect(fc.pending()).toBe(0);
		expect(d.getSnapshot().stimulus).toBeUndefined();
	});

	test("event log carries offsets relative to origin", () => {
		const fc = fakeClock();
		const d = createDriver(config(), { id: "s", seed: "k", deps: { clock: fc.clock } });
		fc.advance(123); // origin captured at start, not construction
		d.start();
		fc.advance(1000);
		fc.advance(500);
		fc.advance(1000);
		fc.advance(500);
		const rec = d.record()!;
		expect(rec.events.length).toBeGreaterThan(0);
		// offset excludes pre-start 123
		expect(rec.events[0]).toEqual({ type: "trialClosed", offset: 1000 });
		expect(rec.version).toBe(game.SESSION_RECORD_VERSION);
		expect(rec.stimuli.length).toBe(2);
	});
});

describe("driver inputs & feedback", () => {
	test("records every respond verbatim, including ignored taps during feedback", () => {
		const fc = fakeClock();
		const d = createDriver(
			config({ n: 1, problemCount: 1 }),
			{ id: "s", seed: "k", deps: { clock: fc.clock } },
		);
		d.start();
		fc.advance(1000);
		fc.advance(500);
		d.engage(game.MOD_COLOR);
		d.disengage(game.MOD_COLOR);
		d.engage(game.MOD_COLOR);
		fc.advance(1000);
		d.engage(game.MOD_COLOR); // ignored: feedback phase, not responding
		const responded = d.record()!.events.filter(
			(e): e is game.Responded => e.type === "responded",
		);
		expect(responded.length).toBe(4); // 3 accepted + 1 ignored
		expect(
			responded.filter((r) => game.resultOf(r.reason) === "accepted").length,
		).toBe(3);
		expect(responded.some((r) => r.reason === "notResponding")).toBe(true);
	});

	test("live feedback reflects the optimal response (correct === true)", () => {
		const fc = fakeClock();
		const d = createDriver(
			config({ n: 1, problemCount: 1 }),
			{ id: "s", seed: "feedback-seed", deps: { clock: fc.clock } },
		);
		d.start();
		fc.advance(1000); // memo trial, no feedback
		expect(d.getSnapshot().feedback).toBeUndefined();
		fc.advance(500);

		// engage iff matches t-N (optimal response)
		const cur = d.getSnapshot().stimulus!;
		const prevColor = stimulusColorAt(d, 0);
		const curColor = game.trialStimulusValue(cur, game.MOD_COLOR);
		if (curColor === prevColor) d.engage(game.MOD_COLOR);

		fc.advance(1000);
		const fb = d.getSnapshot().feedback!;
		expect(fb).toBeDefined();
		expect(fb.every((f) => game.outcomeIsCorrect(f.outcome))).toBe(true);
		const color = fb.find((f) => f.mod === game.MOD_COLOR)!;
		expect(game.outcomeIsMatch(color.outcome)).toBe(curColor === prevColor);
		expect(game.outcomeIsEngaged(color.outcome)).toBe(curColor === prevColor);
		expect(color.outcome).toBe(
			curColor === prevColor ? game.OUTCOME_HIT : game.OUTCOME_CORRECT_REJECT,
		);
	});

	// incorrect branch: precondition asserted from the trace, so seed drift fails loud (not a silent branch flip).
	test("missed match yields MISS feedback (correct === false)", () => {
		const fc = fakeClock();
		const d = createDriver(config(), { id: "s", seed: "c", deps: { clock: fc.clock } });
		d.start();
		expect(stimulusColorAt(d, 1)).toBe(stimulusColorAt(d, 0)); // scored trial is a match
		fc.advance(1000); // memo trial 0
		fc.advance(500); // -> responding(1), scored
		// leave the match unresponded
		fc.advance(1000); // -> feedback(1)
		const color = d.getSnapshot().feedback!.find((f) => f.mod === game.MOD_COLOR)!;
		expect(color.outcome).toBe(game.OUTCOME_MISS);
		expect(game.outcomeIsCorrect(color.outcome)).toBe(false);
	});

	test("engaging a non-match yields FALSE_ALARM feedback (correct === false)", () => {
		const fc = fakeClock();
		const d = createDriver(config(), { id: "s", seed: "k", deps: { clock: fc.clock } });
		d.start();
		expect(stimulusColorAt(d, 1)).not.toBe(stimulusColorAt(d, 0)); // scored trial is a non-match
		fc.advance(1000); // memo trial 0
		fc.advance(500); // -> responding(1), scored
		d.engage(game.MOD_COLOR); // engage a non-match
		fc.advance(1000); // -> feedback(1)
		const color = d.getSnapshot().feedback!.find((f) => f.mod === game.MOD_COLOR)!;
		expect(color.outcome).toBe(game.OUTCOME_FALSE_ALARM);
		expect(game.outcomeIsCorrect(color.outcome)).toBe(false);
	});

	test("ignores inputs before start and after done", () => {
		const fc = fakeClock();
		const d = createDriver(config(), { id: "s", seed: "k", deps: { clock: fc.clock } });
		d.engage(game.MOD_COLOR);
		expect(d.record()).toBeUndefined();
		d.start();
		fc.advance(3000);
		const before = d.record()!.events.length;
		d.engage(game.MOD_COLOR);
		expect(d.record()!.events.length).toBe(before);
	});
});

function stimulusColorAt(d: driver.SessionDriver, t: number): game.Option | undefined {
	const rec = d.record();
	return rec ? game.trialStimulusValue(rec.stimuli[t]!, game.MOD_COLOR) : undefined;
}

describe("driver determinism & abort", () => {
	test("same seed + same scripted timeline -> identical records", () => {
		function run(): game.SessionRecord {
			const fc = fakeClock();
			const d = createDriver(
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
		const d = createDriver(
			config({ n: 1, problemCount: 5 }),
			{ id: "s", seed: "k", deps: { clock: fc.clock } },
		);
		d.start();
		fc.advance(1000);
		d.abort();
		expect(d.getSnapshot().status).toBe("aborted");
		expect(fc.pending()).toBe(0);
		const frozen = d.record()!.events.length;
		fc.advance(10000);
		expect(d.record()!.events.length).toBe(frozen);
	});

	test("notifies subscribers on change and stops after unsubscribe", () => {
		const fc = fakeClock();
		const d = createDriver(config(), { id: "s", seed: "k", deps: { clock: fc.clock } });
		let count = 0;
		const unsub = d.subscribe(() => {
			count++;
		});
		d.start();
		fc.advance(1000);
		expect(count).toBeGreaterThanOrEqual(2);
		const at = count;
		unsub();
		fc.advance(500);
		expect(count).toBe(at);
	});

	test("record() returns an immutable snapshot, decoupled from the live log", () => {
		const fc = fakeClock();
		const d = createDriver(
			config({ n: 1, problemCount: 5 }),
			{ id: "s", seed: "k", deps: { clock: fc.clock } },
		);
		d.start();
		fc.advance(1000);
		const captured = d.record()!;
		const lenAtCapture = captured.events.length;
		expect(lenAtCapture).toBeGreaterThan(0);
		fc.advance(500);
		fc.advance(1000);
		// captured record must not grow (no aliasing to live log)
		expect(captured.events.length).toBe(lenAtCapture);
		expect(d.record()!.events.length).toBeGreaterThan(lenAtCapture);
	});
});
