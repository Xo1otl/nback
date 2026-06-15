import { describe, expect, test } from "bun:test";
import * as game from "@/game";

const TIMING: game.TimingConfig = {
	respondingDuration: 2000,
	feedbackDuration: 500,
};

function simpleConfig(
	overrides: Partial<game.SessionConfig> = {},
): game.SessionConfig {
	return {
		n: 2,
		problemCount: 6,
		matchProbability: 0.5,
		timing: TIMING,
		mods: [{ mod: game.MOD_COLOR, options: game.CANONICAL_COLOR }],
		...overrides,
	};
}

describe("validateAndResolveConfig", () => {
	test("accepts a valid config and preserves fields", () => {
		const spec = game.validateAndResolveConfig(simpleConfig());
		expect(spec.n).toBe(2);
		expect(spec.problemCount).toBe(6);
		expect(spec.matchProbability).toBe(0.5);
		expect(game.totalTrials(spec)).toBe(8);
	});

	test("fills canonical defaults when options are empty", () => {
		const spec = game.validateAndResolveConfig(
			simpleConfig({ mods: [{ mod: game.MOD_SHAPE, options: [] }] }),
		);
		expect(game.specMod(spec, game.MOD_SHAPE)?.options).toEqual(
			game.CANONICAL_SHAPE,
		);
	});

	test("allows free-form position coordinate IDs", () => {
		const spec = game.validateAndResolveConfig(
			simpleConfig({
				mods: [{ mod: game.MOD_POSITION, options: ["r0c0", "r0c1", "r1c0"] }],
			}),
		);
		expect(game.specMod(spec, game.MOD_POSITION)?.options.length).toBe(3);
	});

	test("rejects free-form position with empty options (no canonical default)", () => {
		expect(() =>
			game.validateAndResolveConfig(
				simpleConfig({ mods: [{ mod: game.MOD_POSITION, options: [] }] }),
			),
		).toThrow(game.ConfigError);
	});

	test.each([
		["n < 1", { n: 0 }],
		["non-integer n", { n: 1.5 }],
		["problemCount < 1", { problemCount: 0 }],
		["p = 0 (open interval)", { matchProbability: 0 }],
		["p = 1 (open interval)", { matchProbability: 1 }],
		["p > 1", { matchProbability: 1.5 }],
	])("rejects %s", (_label, overrides) => {
		expect(() =>
			game.validateAndResolveConfig(simpleConfig(overrides)),
		).toThrow(game.ConfigError);
	});

	test("rejects respondingDuration <= 0", () => {
		expect(() =>
			game.validateAndResolveConfig(
				simpleConfig({ timing: { respondingDuration: 0, feedbackDuration: 0 } }),
			),
		).toThrow(game.ConfigError);
	});

	test("rejects k < 2", () => {
		expect(() =>
			game.validateAndResolveConfig(
				simpleConfig({ mods: [{ mod: game.MOD_COLOR, options: ["red"] }] }),
			),
		).toThrow(game.ConfigError);
	});

	test("rejects no enabled modalities", () => {
		expect(() =>
			game.validateAndResolveConfig(simpleConfig({ mods: [] })),
		).toThrow(game.ConfigError);
	});

	test("rejects duplicate modality", () => {
		expect(() =>
			game.validateAndResolveConfig(
				simpleConfig({
					mods: [
						{ mod: game.MOD_COLOR, options: game.CANONICAL_COLOR },
						{ mod: game.MOD_COLOR, options: game.CANONICAL_COLOR },
					],
				}),
			),
		).toThrow(game.ConfigError);
	});

	test("rejects duplicate option within a modality", () => {
		expect(() =>
			game.validateAndResolveConfig(
				simpleConfig({ mods: [{ mod: game.MOD_COLOR, options: ["red", "red"] }] }),
			),
		).toThrow(game.ConfigError);
	});

	test("rejects option outside the canonical set", () => {
		expect(() =>
			game.validateAndResolveConfig(
				simpleConfig({ mods: [{ mod: game.MOD_COLOR, options: ["red", "cyan"] }] }),
			),
		).toThrow(game.ConfigError);
	});
});

describe("newRandomSource", () => {
	test("is deterministic for a given seed", () => {
		const a = game.newRandomSource("seed-1");
		const b = game.newRandomSource("seed-1");
		const seqA = Array.from({ length: 20 }, () => a.float64());
		const seqB = Array.from({ length: 20 }, () => b.float64());
		expect(seqA).toEqual(seqB);
	});

	test("differs across seeds", () => {
		const a = game.newRandomSource("seed-1");
		const b = game.newRandomSource("seed-2");
		expect(a.float64()).not.toBe(b.float64());
	});

	test("intn stays within [0, n) and rejects n <= 0", () => {
		const r = game.newRandomSource("x");
		for (let i = 0; i < 1000; i++) {
			const v = r.intn(7);
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(7);
			expect(Number.isInteger(v)).toBe(true);
		}
		expect(() => r.intn(0)).toThrow(RangeError);
	});
});

describe("generateStimuli", () => {
	const spec = game.validateAndResolveConfig(
		simpleConfig({ n: 3, problemCount: 200, matchProbability: 0.5 }),
	);

	test("produces totalTrials trials with sequential indices and an in-set value per mod", () => {
		const trace = game.generateStimuli(spec, game.newRandomSource("g"));
		expect(trace.length).toBe(game.totalTrials(spec));
		trace.forEach((ts, i) => {
			expect(ts.trial).toBe(i);
			const value = game.trialStimulusValue(ts, game.MOD_COLOR);
			expect(value).toBeDefined();
			expect(game.CANONICAL_COLOR).toContain(value!);
		});
	});

	test("is reproducible from the same seed", () => {
		const a = game.generateStimuli(spec, game.newRandomSource("same"));
		const b = game.generateStimuli(spec, game.newRandomSource("same"));
		expect(a).toEqual(b);
	});

	test("match probability is honored (~p over scored trials)", () => {
		const trace = game.generateStimuli(spec, game.newRandomSource("stats"));
		let matches = 0;
		let scored = 0;
		for (let t = spec.n; t < trace.length; t++) {
			scored++;
			const cur = game.trialStimulusValue(trace[t]!, game.MOD_COLOR);
			const prev = game.trialStimulusValue(trace[t - spec.n]!, game.MOD_COLOR);
			if (cur === prev) matches++;
		}
		const rate = matches / scored;
		expect(rate).toBeGreaterThan(0.35);
		expect(rate).toBeLessThan(0.65);
	});

	test("p = 0 never matches the lookback", () => {
		const noMatch = game.validateAndResolveConfig(
			simpleConfig({ n: 2, problemCount: 50, matchProbability: 0.001 }),
		);
		const trace = game.generateStimuli(noMatch, game.newRandomSource("nomatch"));
		// With p ~ 0 essentially all scored trials should differ from t-N.
		let matches = 0;
		for (let t = noMatch.n; t < trace.length; t++) {
			const cur = game.trialStimulusValue(trace[t]!, game.MOD_COLOR);
			const prev = game.trialStimulusValue(trace[t - noMatch.n]!, game.MOD_COLOR);
			if (cur === prev) matches++;
		}
		expect(matches).toBe(0);
	});

	test("modalities are independent streams, each drawn from its own option set", () => {
		const multi = game.validateAndResolveConfig(
			simpleConfig({
				n: 2,
				problemCount: 200,
				mods: [
					{ mod: game.MOD_COLOR, options: game.CANONICAL_COLOR },
					{ mod: game.MOD_SHAPE, options: game.CANONICAL_SHAPE },
				],
			}),
		);
		const trace = game.generateStimuli(multi, game.newRandomSource("multi"));
		let colorMatches = 0;
		let shapeMatches = 0;
		let coincidences = 0;
		for (let t = 0; t < trace.length; t++) {
			const color = game.trialStimulusValue(trace[t]!, game.MOD_COLOR);
			const shape = game.trialStimulusValue(trace[t]!, game.MOD_SHAPE);
			// every trial carries a value per enabled mod, from that mod's own set
			expect(color).toBeDefined();
			expect(shape).toBeDefined();
			expect(game.CANONICAL_COLOR).toContain(color!);
			expect(game.CANONICAL_SHAPE).toContain(shape!);
			if (t >= multi.n) {
				const cMatch = color === game.trialStimulusValue(trace[t - multi.n]!, game.MOD_COLOR);
				const sMatch = shape === game.trialStimulusValue(trace[t - multi.n]!, game.MOD_SHAPE);
				if (cMatch) colorMatches++;
				if (sMatch) shapeMatches++;
				if (cMatch === sMatch) coincidences++;
			}
		}
		// both streams are live and not in lockstep with each other
		expect(colorMatches).toBeGreaterThan(0);
		expect(shapeMatches).toBeGreaterThan(0);
		expect(coincidences).toBeLessThan(trace.length - multi.n);
	});
});

describe("state machine", () => {
	const cfg = simpleConfig({ n: 1, problemCount: 2 }); // T = 3

	test("startSession begins in responding(0) with onset 0", () => {
		const s = game.startSession(cfg, game.newRandomSource("sm"));
		expect(s.state).toEqual({
			phase: "responding",
			trial: 0,
			respondingOnset: 0,
			responses: [],
		});
		expect(s.stimuli.length).toBe(3);
	});

	test("closeTrial moves responding(t) -> feedback(t)", () => {
		const s = game.startSession(cfg, game.newRandomSource("sm"));
		const { event, state } = game.closeTrial(s.state, 1500);
		expect(event).toEqual({ type: "trialClosed", offset: 1500 });
		expect(state.phase).toBe("feedback");
		expect(state.trial).toBe(0);
	});

	test("nextTrial moves feedback(t) -> responding(t+1) with new onset", () => {
		const s = game.startSession(cfg, game.newRandomSource("sm"));
		const closed = game.closeTrial(s.state, 1500);
		const { event, state } = game.nextTrial(s.spec, closed.state, 2000);
		expect(event).toEqual({ type: "trialAdvanced", offset: 2000 });
		expect(state).toEqual({
			phase: "responding",
			trial: 1,
			respondingOnset: 2000,
			responses: [],
		});
	});

	test("nextTrial after the last trial -> done", () => {
		const s = game.startSession(cfg, game.newRandomSource("sm"));
		// advance to the last trial (index T-1 = 2)
		let state = s.state;
		state = game.closeTrial(state, 100).state;
		state = game.nextTrial(s.spec, state, 200).state; // trial 1
		state = game.closeTrial(state, 300).state;
		state = game.nextTrial(s.spec, state, 400).state; // trial 2 (last)
		expect(state.trial).toBe(2);
		state = game.closeTrial(state, 500).state;
		const advanced = game.nextTrial(s.spec, state, 600);
		expect(advanced.state.phase).toBe("done");
	});

	test("transition events are no-ops out of phase", () => {
		const s = game.startSession(cfg, game.newRandomSource("sm"));
		// nextTrial during responding is a no-op
		const adv = game.nextTrial(s.spec, s.state, 100);
		expect(adv.state).toEqual(s.state);
		// closeTrial during feedback is a no-op
		const feedback = game.closeTrial(s.state, 100).state;
		const closedAgain = game.closeTrial(feedback, 200);
		expect(closedAgain.state).toEqual(feedback);
	});
});

describe("respond", () => {
	const spec = game.validateAndResolveConfig(simpleConfig({ n: 2, problemCount: 4 }));
	const responding = (trial: number): game.SessionState => ({
		phase: "responding",
		trial,
		respondingOnset: 1000,
		responses: [],
	});

	test("accepts a valid engage within the window on a scored trial", () => {
		const { event } = game.respond(spec, responding(2), game.MOD_COLOR, "engage", 1500);
		expect(event).toEqual({
			type: "responded",
			offset: 1500,
			mod: game.MOD_COLOR,
			action: "engage",
			result: "accepted",
			reason: "",
		});
	});

	test("ignores responses on a memorization trial", () => {
		const { event } = game.respond(spec, responding(1), game.MOD_COLOR, "engage", 1500);
		expect(event.result).toBe("ignored");
		expect(event.reason).toBe("memoTrial");
	});

	test("ignores responses outside the responding phase", () => {
		const feedback: game.SessionState = {
			phase: "feedback",
			trial: 2,
			respondingOnset: 1000,
			responses: [],
		};
		const { event } = game.respond(spec, feedback, game.MOD_COLOR, "engage", 1500);
		expect(event.result).toBe("ignored");
		expect(event.reason).toBe("notResponding");
	});

	test("rejects responses for a modality not enabled", () => {
		const { event } = game.respond(spec, responding(2), game.MOD_AUDIO, "engage", 1500);
		expect(event.result).toBe("rejected");
		expect(event.reason).toBe("modNotEnabled");
	});

	test("rejects responses past the responding window", () => {
		const { event } = game.respond(spec, responding(2), game.MOD_COLOR, "engage", 1000 + 2001);
		expect(event.result).toBe("rejected");
		expect(event.reason).toBe("outsideWindow");
	});

	test("rejects responses before the onset", () => {
		const { event } = game.respond(spec, responding(2), game.MOD_COLOR, "engage", 999);
		expect(event.result).toBe("rejected");
		expect(event.reason).toBe("outsideWindow");
	});

	test("accepts exactly at the window boundary", () => {
		const { event } = game.respond(spec, responding(2), game.MOD_COLOR, "engage", 1000 + 2000);
		expect(event.result).toBe("accepted");
	});

	test("accepts exactly at the onset (lower boundary, elapsed = 0)", () => {
		const { event } = game.respond(spec, responding(2), game.MOD_COLOR, "engage", 1000);
		expect(event.result).toBe("accepted");
	});

	test("accepts a valid disengage and preserves the action on the event", () => {
		const { event } = game.respond(spec, responding(2), game.MOD_COLOR, "disengage", 1500);
		expect(event.result).toBe("accepted");
		expect(event.action).toBe("disengage");
	});

	test("validation precedence follows responding -> scored -> mod -> window", () => {
		// memo trial AND disabled mod -> memoTrial wins (scored checked before mod)
		expect(
			game.respond(spec, responding(1), game.MOD_AUDIO, "engage", 1500).event.reason,
		).toBe("memoTrial");
		// scored, disabled mod AND out-of-window -> modNotEnabled wins (mod before window)
		expect(
			game.respond(spec, responding(2), game.MOD_AUDIO, "engage", 99999).event.reason,
		).toBe("modNotEnabled");
		// not responding AND memo trial -> notResponding wins (phase checked first)
		const feedback: game.SessionState = {
			phase: "feedback",
			trial: 1,
			respondingOnset: 1000,
			responses: [],
		};
		expect(
			game.respond(spec, feedback, game.MOD_AUDIO, "engage", 1500).event.reason,
		).toBe("notResponding");
	});
});

describe("respond folds the final action into SessionState", () => {
	const spec = game.validateAndResolveConfig(
		simpleConfig({
			n: 2,
			problemCount: 4,
			mods: [
				{ mod: game.MOD_COLOR, options: game.CANONICAL_COLOR },
				{ mod: game.MOD_SHAPE, options: game.CANONICAL_SHAPE },
			],
		}),
	);
	const responding = (trial: number): game.SessionState => ({
		phase: "responding",
		trial,
		respondingOnset: 1000,
		responses: [],
	});

	test("an accepted response sets the modality's engaged state", () => {
		const { state } = game.respond(spec, responding(2), game.MOD_COLOR, "engage", 1500);
		expect(game.isEngaged(state, game.MOD_COLOR)).toBe(true);
		expect(game.responseFor(state, game.MOD_COLOR)).toBe("engage");
		// default for a mod never acted on is disengage
		expect(game.responseFor(state, game.MOD_SHAPE)).toBe("disengage");
		expect(game.isEngaged(state, game.MOD_SHAPE)).toBe(false);
	});

	test("last accepted action wins (engage then disengage = disengaged)", () => {
		let state = responding(2);
		state = game.respond(spec, state, game.MOD_COLOR, "engage", 1100).state;
		state = game.respond(spec, state, game.MOD_COLOR, "disengage", 1200).state;
		expect(game.isEngaged(state, game.MOD_COLOR)).toBe(false);
		// only one entry per mod (overwrite, not append)
		expect(state.responses.filter((r) => r.mod === game.MOD_COLOR).length).toBe(1);
	});

	test("modalities fold independently", () => {
		let state = responding(2);
		state = game.respond(spec, state, game.MOD_COLOR, "engage", 1100).state;
		state = game.respond(spec, state, game.MOD_SHAPE, "engage", 1200).state;
		expect(game.isEngaged(state, game.MOD_COLOR)).toBe(true);
		expect(game.isEngaged(state, game.MOD_SHAPE)).toBe(true);
	});

	test("non-accepted responses do not change state", () => {
		const start = responding(2);
		// out of window -> rejected, state unchanged
		const rejected = game.respond(spec, start, game.MOD_COLOR, "engage", 99999);
		expect(rejected.state).toBe(start);
		// memo trial -> ignored, state unchanged
		const ignored = game.respond(spec, responding(1), game.MOD_COLOR, "engage", 1500);
		expect(ignored.state.responses).toEqual([]);
	});

	test("nextTrial resets responses; closeTrial preserves them", () => {
		let state = responding(2);
		state = game.respond(spec, state, game.MOD_COLOR, "engage", 1100).state;
		// closeTrial keeps responses so feedback(t) can read them
		const closed = game.closeTrial(state, 1500);
		expect(game.isEngaged(closed.state, game.MOD_COLOR)).toBe(true);
		// nextTrial clears them for the new trial
		const advanced = game.nextTrial(spec, closed.state, 2000);
		expect(advanced.state.responses).toEqual([]);
		expect(game.isEngaged(advanced.state, game.MOD_COLOR)).toBe(false);
	});
});

describe("newSessionRecord", () => {
	test("stamps the current SESSION_RECORD_VERSION and threads fields", () => {
		const s = game.validateAndResolveConfig(simpleConfig());
		const rec = game.newSessionRecord("sess-1", s, "seed-1", [], 12345, []);
		expect(rec.version).toBe(game.SESSION_RECORD_VERSION);
		expect(rec.version).toBe(3);
		expect(rec.id).toBe("sess-1");
		expect(rec.seed).toBe("seed-1");
		expect(rec.origin).toBe(12345);
		expect(rec.spec).toBe(s);
	});
});
