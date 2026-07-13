import { describe, expect, test } from "bun:test";
import * as game from "@/game";
import { generateStimuli } from "./_stimuli";

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

function resolve(cfg: game.SessionConfig): game.SessionSpec {
	const spec = game.validateAndResolveConfig(cfg);
	if (spec instanceof game.ConfigError) throw spec;
	return spec;
}

function start(cfg: game.SessionConfig, seed: string): game.StartedSession {
	const s = game.startSession(cfg, game.newRandomSource(seed));
	if (s instanceof game.ConfigError) throw s;
	return s;
}

describe("validateAndResolveConfig", () => {
	test("accepts a valid config and preserves fields", () => {
		const spec = resolve(simpleConfig());
		expect(spec.n).toBe(2);
		expect(spec.problemCount).toBe(6);
		expect(spec.matchProbability).toBe(0.5);
		expect(game.totalTrials(spec)).toBe(8);
	});

	test("fills canonical defaults when options are empty", () => {
		const spec = resolve(
			simpleConfig({ mods: [{ mod: game.MOD_SHAPE, options: [] }] }),
		);
		expect(game.specMod(spec, game.MOD_SHAPE)?.options).toEqual(
			game.CANONICAL_SHAPE,
		);
	});

	test("allows free-form position coordinate IDs", () => {
		const spec = resolve(
			simpleConfig({
				mods: [{ mod: game.MOD_POSITION, options: ["r0c0", "r0c1", "r1c0"] }],
			}),
		);
		expect(game.specMod(spec, game.MOD_POSITION)?.options.length).toBe(3);
	});

	test("rejects free-form position with empty options (no canonical default)", () => {
		expect(
			game.validateAndResolveConfig(
				simpleConfig({ mods: [{ mod: game.MOD_POSITION, options: [] }] }),
			),
		).toBeInstanceOf(game.ConfigError);
	});

	test.each([
		["n < 1", { n: 0 }],
		["non-integer n", { n: 1.5 }],
		["problemCount < 1", { problemCount: 0 }],
		["p = 0 (open interval)", { matchProbability: 0 }],
		["p = 1 (open interval)", { matchProbability: 1 }],
		["p > 1", { matchProbability: 1.5 }],
	])("rejects %s", (_label, overrides) => {
		expect(
			game.validateAndResolveConfig(simpleConfig(overrides)),
		).toBeInstanceOf(game.ConfigError);
	});

	test("rejects respondingDuration <= 0", () => {
		expect(
			game.validateAndResolveConfig(
				simpleConfig({ timing: { respondingDuration: 0, feedbackDuration: 0 } }),
			),
		).toBeInstanceOf(game.ConfigError);
	});

	test("rejects k < MIN_OPTIONS_PER_MOD", () => {
		expect(
			game.validateAndResolveConfig(
				simpleConfig({ mods: [{ mod: game.MOD_COLOR, options: ["red"] }] }),
			),
		).toBeInstanceOf(game.ConfigError);
	});

	test("rejects fewer than MIN_ENABLED_MODS modalities", () => {
		expect(
			game.validateAndResolveConfig(simpleConfig({ mods: [] })),
		).toBeInstanceOf(game.ConfigError);
	});

	test("rejects duplicate modality", () => {
		expect(
			game.validateAndResolveConfig(
				simpleConfig({
					mods: [
						{ mod: game.MOD_COLOR, options: game.CANONICAL_COLOR },
						{ mod: game.MOD_COLOR, options: game.CANONICAL_COLOR },
					],
				}),
			),
		).toBeInstanceOf(game.ConfigError);
	});

	test("rejects duplicate option within a modality", () => {
		expect(
			game.validateAndResolveConfig(
				simpleConfig({ mods: [{ mod: game.MOD_COLOR, options: ["red", "red"] }] }),
			),
		).toBeInstanceOf(game.ConfigError);
	});

	test("rejects option outside the canonical set", () => {
		expect(
			game.validateAndResolveConfig(
				simpleConfig({ mods: [{ mod: game.MOD_COLOR, options: ["red", "cyan"] }] }),
			),
		).toBeInstanceOf(game.ConfigError);
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
	const spec = resolve(
		simpleConfig({ n: 3, problemCount: 200, matchProbability: 0.5 }),
	);

	test("produces totalTrials trials with sequential indices and an in-set value per mod", () => {
		const trace = generateStimuli(spec, game.newRandomSource("g"));
		expect(trace.length).toBe(game.totalTrials(spec));
		trace.forEach((ts, i) => {
			expect(ts.trial).toBe(i);
			const value = game.trialStimulusValue(ts, game.MOD_COLOR);
			expect(value).toBeDefined();
			expect(game.CANONICAL_COLOR).toContain(value!);
		});
	});

	test("is reproducible from the same seed", () => {
		const a = generateStimuli(spec, game.newRandomSource("same"));
		const b = generateStimuli(spec, game.newRandomSource("same"));
		expect(a).toEqual(b);
	});

	test("match probability is honored (~p over scored trials)", () => {
		const trace = generateStimuli(spec, game.newRandomSource("stats"));
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

	test("p = 0 never matches: non-match pool structurally excludes the lookback value", () => {
		// p=0 unrepresentable via validation (open interval); raw spec pins the branch guarantee
		const noMatch: game.SessionSpec = {
			n: 2,
			problemCount: 50,
			matchProbability: 0,
			timing: TIMING,
			mods: [{ mod: game.MOD_COLOR, options: game.CANONICAL_COLOR }],
		};
		const trace = generateStimuli(noMatch, game.newRandomSource("nomatch"));
		for (let t = noMatch.n; t < trace.length; t++) {
			const cur = game.trialStimulusValue(trace[t]!, game.MOD_COLOR);
			const prev = game.trialStimulusValue(trace[t - noMatch.n]!, game.MOD_COLOR);
			expect(cur).not.toBe(prev);
		}
	});

	test("modalities are independent streams, each drawn from its own option set", () => {
		const multi = resolve(
			simpleConfig({
				n: 2,
				problemCount: 200,
				mods: [
					{ mod: game.MOD_COLOR, options: game.CANONICAL_COLOR },
					{ mod: game.MOD_SHAPE, options: game.CANONICAL_SHAPE },
				],
			}),
		);
		const trace = generateStimuli(multi, game.newRandomSource("multi"));
		let colorMatches = 0;
		let shapeMatches = 0;
		let coincidences = 0;
		for (let t = 0; t < trace.length; t++) {
			const color = game.trialStimulusValue(trace[t]!, game.MOD_COLOR);
			const shape = game.trialStimulusValue(trace[t]!, game.MOD_SHAPE);
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
		expect(colorMatches).toBeGreaterThan(0);
		expect(shapeMatches).toBeGreaterThan(0);
		expect(coincidences).toBeLessThan(trace.length - multi.n);
	});
});

describe("state machine", () => {
	const cfg = simpleConfig({ n: 1, problemCount: 2 }); // T=3

	test("startSession begins in responding(0) with onset 0", () => {
		const s = start(cfg, "sm");
		expect(s.state).toEqual({
			phase: "responding",
			trial: 0,
			respondingOnset: 0,
			responses: [],
		});
		expect(s.stimuli.length).toBe(3);
	});

	test("startSession returns ConfigError on invalid config", () => {
		expect(
			game.startSession(simpleConfig({ mods: [] }), game.newRandomSource("sm")),
		).toBeInstanceOf(game.ConfigError);
	});

	test("closeTrial moves responding(t) -> feedback(t)", () => {
		const s = start(cfg, "sm");
		const { event, state } = game.closeTrial(s.state, 1500);
		expect(event).toEqual({ type: "trialClosed", offset: 1500 });
		expect(state.phase).toBe("feedback");
		expect(state.trial).toBe(0);
	});

	test("nextTrial moves feedback(t) -> responding(t+1) with new onset", () => {
		const s = start(cfg, "sm");
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
		const s = start(cfg, "sm");
		// last trial index T-1 = 2
		let state = s.state;
		state = game.closeTrial(state, 100).state;
		state = game.nextTrial(s.spec, state, 200).state;
		state = game.closeTrial(state, 300).state;
		state = game.nextTrial(s.spec, state, 400).state;
		expect(state.trial).toBe(2);
		state = game.closeTrial(state, 500).state;
		const advanced = game.nextTrial(s.spec, state, 600);
		expect(advanced.state.phase).toBe("done");
	});

	test("transition events are no-ops out of phase", () => {
		const s = start(cfg, "sm");
		const adv = game.nextTrial(s.spec, s.state, 100);
		expect(adv.state).toEqual(s.state);
		const feedback = game.closeTrial(s.state, 100).state;
		const closedAgain = game.closeTrial(feedback, 200);
		expect(closedAgain.state).toEqual(feedback);
	});
});

describe("respond", () => {
	const spec = resolve(simpleConfig({ n: 2, problemCount: 4 }));
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
			reason: "",
		});
		expect(game.resultOf(event.reason)).toBe("accepted");
	});

	test("ignores responses on a memorization trial", () => {
		const { event } = game.respond(spec, responding(1), game.MOD_COLOR, "engage", 1500);
		expect(event.reason).toBe("memoTrial");
		expect(game.resultOf(event.reason)).toBe("ignored");
	});

	test("ignores responses outside the responding phase", () => {
		const feedback: game.SessionState = {
			phase: "feedback",
			trial: 2,
			respondingOnset: 1000,
			responses: [],
		};
		const { event } = game.respond(spec, feedback, game.MOD_COLOR, "engage", 1500);
		expect(event.reason).toBe("notResponding");
		expect(game.resultOf(event.reason)).toBe("ignored");
	});

	test("rejects responses for a modality not enabled", () => {
		const { event } = game.respond(spec, responding(2), game.MOD_AUDIO, "engage", 1500);
		expect(event.reason).toBe("modNotEnabled");
		expect(game.resultOf(event.reason)).toBe("rejected");
	});

	test("rejects responses past the responding window", () => {
		const { event } = game.respond(spec, responding(2), game.MOD_COLOR, "engage", 1000 + 2001);
		expect(event.reason).toBe("outsideWindow");
		expect(game.resultOf(event.reason)).toBe("rejected");
	});

	test("rejects responses before the onset", () => {
		const { event } = game.respond(spec, responding(2), game.MOD_COLOR, "engage", 999);
		expect(event.reason).toBe("outsideWindow");
	});

	test("accepts exactly at the window boundary", () => {
		const { event } = game.respond(spec, responding(2), game.MOD_COLOR, "engage", 1000 + 2000);
		expect(game.resultOf(event.reason)).toBe("accepted");
	});

	test("accepts exactly at the onset (lower boundary, elapsed = 0)", () => {
		const { event } = game.respond(spec, responding(2), game.MOD_COLOR, "engage", 1000);
		expect(game.resultOf(event.reason)).toBe("accepted");
	});

	test("accepts a valid disengage and preserves the action on the event", () => {
		const { event } = game.respond(spec, responding(2), game.MOD_COLOR, "disengage", 1500);
		expect(game.resultOf(event.reason)).toBe("accepted");
		expect(event.action).toBe("disengage");
	});

	test("validation precedence follows responding -> scored -> mod -> window", () => {
		expect(
			game.respond(spec, responding(1), game.MOD_AUDIO, "engage", 1500).event.reason,
		).toBe("memoTrial");
		expect(
			game.respond(spec, responding(2), game.MOD_AUDIO, "engage", 99999).event.reason,
		).toBe("modNotEnabled");
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
	const spec = resolve(
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
		expect(game.responseFor(state, game.MOD_SHAPE)).toBe("disengage");
		expect(game.isEngaged(state, game.MOD_SHAPE)).toBe(false);
	});

	test("last accepted action wins (engage then disengage = disengaged)", () => {
		let state = responding(2);
		state = game.respond(spec, state, game.MOD_COLOR, "engage", 1100).state;
		state = game.respond(spec, state, game.MOD_COLOR, "disengage", 1200).state;
		expect(game.isEngaged(state, game.MOD_COLOR)).toBe(false);
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
		const rejected = game.respond(spec, start, game.MOD_COLOR, "engage", 99999);
		expect(rejected.state).toBe(start);
		const ignored = game.respond(spec, responding(1), game.MOD_COLOR, "engage", 1500);
		expect(ignored.state.responses).toEqual([]);
	});

	test("nextTrial resets responses; closeTrial preserves them", () => {
		let state = responding(2);
		state = game.respond(spec, state, game.MOD_COLOR, "engage", 1100).state;
		const closed = game.closeTrial(state, 1500);
		expect(game.isEngaged(closed.state, game.MOD_COLOR)).toBe(true);
		const advanced = game.nextTrial(spec, closed.state, 2000);
		expect(advanced.state.responses).toEqual([]);
		expect(game.isEngaged(advanced.state, game.MOD_COLOR)).toBe(false);
	});
});

describe("scoring vocabulary (matchAt, outcomeOf, finalEngagedFrom)", () => {
	const stimuli: game.StimulusTrace = [
		{ trial: 0, values: [{ mod: game.MOD_COLOR, value: "red" }] },
		{ trial: 1, values: [{ mod: game.MOD_COLOR, value: "red" }] },
		{ trial: 2, values: [{ mod: game.MOD_COLOR, value: "green" }] },
	];

	test("matchAt compares a modality against its n-back lookback", () => {
		expect(game.matchAt(stimuli, 1, 1, game.MOD_COLOR)).toBe(true);
		expect(game.matchAt(stimuli, 1, 2, game.MOD_COLOR)).toBe(false);
		expect(game.matchAt(stimuli, 2, 2, game.MOD_COLOR)).toBe(false);
	});

	test("matchAt is undefined on memorization trials and out-of-range lookbacks", () => {
		expect(game.matchAt(stimuli, 1, 0, game.MOD_COLOR)).toBeUndefined();
		expect(game.matchAt(stimuli, 2, 1, game.MOD_COLOR)).toBeUndefined();
		expect(game.matchAt(stimuli, 1, 9, game.MOD_COLOR)).toBeUndefined();
	});

	test("outcomeOf maps the 2x2 (match x engaged) confusion matrix", () => {
		expect(game.outcomeOf(true, true)).toBe(game.OUTCOME_HIT);
		expect(game.outcomeOf(true, false)).toBe(game.OUTCOME_MISS);
		expect(game.outcomeOf(false, true)).toBe(game.OUTCOME_FALSE_ALARM);
		expect(game.outcomeOf(false, false)).toBe(game.OUTCOME_CORRECT_REJECT);
	});

	test("outcome predicates: match / engaged / correct classification", () => {
		expect(game.outcomeIsMatch(game.OUTCOME_HIT)).toBe(true);
		expect(game.outcomeIsMatch(game.OUTCOME_MISS)).toBe(true);
		expect(game.outcomeIsMatch(game.OUTCOME_FALSE_ALARM)).toBe(false);
		expect(game.outcomeIsMatch(game.OUTCOME_CORRECT_REJECT)).toBe(false);

		expect(game.outcomeIsEngaged(game.OUTCOME_HIT)).toBe(true);
		expect(game.outcomeIsEngaged(game.OUTCOME_FALSE_ALARM)).toBe(true);
		expect(game.outcomeIsEngaged(game.OUTCOME_MISS)).toBe(false);
		expect(game.outcomeIsEngaged(game.OUTCOME_CORRECT_REJECT)).toBe(false);

		expect(game.outcomeIsCorrect(game.OUTCOME_HIT)).toBe(true);
		expect(game.outcomeIsCorrect(game.OUTCOME_CORRECT_REJECT)).toBe(true);
		expect(game.outcomeIsCorrect(game.OUTCOME_MISS)).toBe(false);
		expect(game.outcomeIsCorrect(game.OUTCOME_FALSE_ALARM)).toBe(false);
	});

	test("finalEngagedFrom replays accepted events (last wins; default disengage)", () => {
		// accepted ⇔ reason "" (resultOf)
		const ev = (
			action: game.ResponseAction,
			reason: game.ReasonCode = "",
		): game.Responded => ({
			type: "responded",
			offset: 0,
			mod: game.MOD_COLOR,
			action,
			reason,
		});
		expect(game.finalEngagedFrom([], game.MOD_COLOR)).toBe(false);
		expect(game.finalEngagedFrom([ev("engage")], game.MOD_COLOR)).toBe(true);
		expect(
			game.finalEngagedFrom(
				[ev("engage"), ev("disengage", "outsideWindow")],
				game.MOD_COLOR,
			),
		).toBe(true);
		expect(
			game.finalEngagedFrom([ev("engage"), ev("disengage")], game.MOD_COLOR),
		).toBe(false);
	});

	test("resultOf maps each reason to its unique result", () => {
		expect(game.resultOf("")).toBe("accepted");
		expect(game.resultOf("notResponding")).toBe("ignored");
		expect(game.resultOf("memoTrial")).toBe("ignored");
		expect(game.resultOf("modNotEnabled")).toBe("rejected");
		expect(game.resultOf("outsideWindow")).toBe("rejected");
	});

	test("the live fold (isEngaged) and the log replay (finalEngagedFrom) agree", () => {
		const spec = resolve(simpleConfig({ n: 2, problemCount: 4 }));
		let state: game.SessionState = {
			phase: "responding",
			trial: 2,
			respondingOnset: 1000,
			responses: [],
		};
		const accepted: game.Responded[] = [];
		let offset = 1100;
		for (const action of ["engage", "disengage", "engage"] as const) {
			const r = game.respond(spec, state, game.MOD_COLOR, action, offset);
			state = r.state;
			if (game.resultOf(r.event.reason) === "accepted") accepted.push(r.event);
			offset += 100;
		}
		expect(game.finalEngagedFrom(accepted, game.MOD_COLOR)).toBe(
			game.isEngaged(state, game.MOD_COLOR),
		);
		expect(game.isEngaged(state, game.MOD_COLOR)).toBe(true);
	});
});

describe("position codec", () => {
	test("parsePosition inverts positionCell", () => {
		expect(game.parsePosition(game.positionCell(2, 1))).toEqual({
			row: 2,
			col: 1,
		});
	});

	test("parsePosition is null on non-position options and undefined", () => {
		expect(game.parsePosition("red")).toBeNull();
		expect(game.parsePosition(undefined)).toBeNull();
	});

	test("positionGridDims bounds parseable cells, min 1x1", () => {
		expect(
			game.positionGridDims([game.positionCell(0, 2), game.positionCell(1, 0)]),
		).toEqual({ rows: 2, cols: 3 });
		expect(game.positionGridDims(["red", "green"])).toEqual({
			rows: 1,
			cols: 1,
		});
	});
});

describe("newSessionRecord", () => {
	test("stamps the current SESSION_RECORD_VERSION and threads fields", () => {
		const s = resolve(simpleConfig());
		const rec = game.newSessionRecord("sess-1", s, "seed-1", [], 12345, []);
		expect(rec.version).toBe(game.SESSION_RECORD_VERSION);
		expect(rec.version).toBe(5);
		expect(rec.id).toBe("sess-1");
		expect(rec.seed).toBe("seed-1");
		expect(rec.createdAt).toBe(12345);
		expect(rec.spec).toBe(s);
	});
});
