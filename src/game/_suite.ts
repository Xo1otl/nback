/**
 * Reusable, factory-parameterized contract suite for the Session state
 * machine. Section references (§) point to specs.md. Step 2-3 runs it against
 * the script-driven mock; step 4 will rerun it against the real
 * implementation, where matches are DERIVED from the sequence — so every
 * script built here is self-consistent: matches[i] for modality m is true iff
 * sequence[n + i][m] === sequence[i][m] (§4 match definition).
 */

import { describe, expect, test } from "bun:test";
import {
	COLOR_OPTIONS,
	type ColorOption,
	type Judgment,
	LETTER_OPTIONS,
	type LetterOption,
	type Modality,
	type PerModality,
	type Session,
	type Settings,
	type Stimulus,
} from "./_contract";
import type { MockScript } from "./_mock";

export type MakeSession = (settings: Settings, script: MockScript) => Session;

// ---- Script construction helpers (test code; consistency per §4/§5) ----

/** Indexed access that throws instead of yielding undefined (test helper). */
function at<T>(values: readonly T[], index: number): T {
	const value = values[index];
	if (value === undefined) {
		throw new Error(`index ${index} out of range`);
	}
	return value;
}

/**
 * Builds one modality's option stream of length n + pattern.length such that
 * stream[n + i] === stream[i] iff pattern[i] (§4). Forced non-matches pick
 * the next catalog option, so every catalog with >= 2 options works.
 */
function buildStream<T>(
	options: readonly T[],
	n: number,
	pattern: readonly boolean[],
): T[] {
	const stream: T[] = [];
	for (let t = 0; t < n; t += 1) {
		stream.push(at(options, t % options.length));
	}
	pattern.forEach((match, i) => {
		const back = at(stream, i);
		stream.push(
			match ? back : at(options, (options.indexOf(back) + 1) % options.length),
		);
	});
	return stream;
}

/** matches[i][m] := sequence[n + i][m] === sequence[i][m] (§4). */
function deriveMatches(
	n: number,
	modalities: readonly Modality[],
	sequence: readonly Stimulus[],
): PerModality<boolean>[] {
	const out: PerModality<boolean>[] = [];
	for (let t = n; t < sequence.length; t += 1) {
		const current = at(sequence, t);
		const back = at(sequence, t - n);
		const entry: Partial<Record<Modality, boolean>> = {};
		for (const m of modalities) {
			entry[m] = current[m] !== undefined && current[m] === back[m];
		}
		out.push(entry);
	}
	return out;
}

/** Desired per-scored-trial match pattern for each enabled modality. */
type MatchPatterns = {
	readonly letter?: readonly boolean[];
	readonly color?: readonly boolean[];
};

type Fixture = {
	readonly settings: Settings;
	readonly script: MockScript;
};

/**
 * Builds settings plus a self-consistent script: the sequence realizes the
 * requested match patterns and `matches` is recomputed from the sequence, so
 * the same fixture drives both the mock and the real implementation (§3).
 */
function makeFixture(n: number, patterns: MatchPatterns): Fixture {
	const problemCount = patterns.letter?.length ?? patterns.color?.length ?? 0;
	if (
		problemCount < 1 ||
		(patterns.letter && patterns.letter.length !== problemCount) ||
		(patterns.color && patterns.color.length !== problemCount)
	) {
		throw new Error("fixture patterns must be non-empty and equal-length");
	}
	const letterStream = patterns.letter
		? buildStream(LETTER_OPTIONS, n, patterns.letter)
		: undefined;
	const colorStream = patterns.color
		? buildStream(COLOR_OPTIONS, n, patterns.color)
		: undefined;
	const modalities: Modality[] = [];
	if (letterStream) {
		modalities.push("letter");
	}
	if (colorStream) {
		modalities.push("color");
	}
	const sequence: Stimulus[] = [];
	for (let t = 0; t < n + problemCount; t += 1) {
		const stimulus: { letter?: LetterOption; color?: ColorOption } = {};
		if (letterStream) {
			stimulus.letter = at(letterStream, t);
		}
		if (colorStream) {
			stimulus.color = at(colorStream, t);
		}
		sequence.push(stimulus);
	}
	const matches = deriveMatches(n, modalities, sequence);
	// Self-check: the derived matches must realize the requested patterns,
	// otherwise the fixture would silently test something else.
	matches.forEach((entry, i) => {
		if (
			(patterns.letter && entry.letter !== at(patterns.letter, i)) ||
			(patterns.color && entry.color !== at(patterns.color, i))
		) {
			throw new Error(`fixture self-check failed at scored trial ${i}`);
		}
	});
	const settings: Settings = {
		n,
		problemCount,
		modalities,
		minMatchProbability: 0,
		presentationMs: 1000,
		feedbackMs: 500,
	};
	return { settings, script: { sequence, matches } };
}

/** Fires closeTrial + nextTrial `count` times (advances whole trials). */
function skipTrials(session: Session, count: number): void {
	for (let i = 0; i < count; i += 1) {
		session.closeTrial();
		session.nextTrial();
	}
}

/** Runs a session from responding(0) to done without responding. */
function runToDone(session: Session): void {
	skipTrials(session, session.totalTrials);
}

// ---- The contract suite ----

export function runSessionContractSuite(
	label: string,
	make: MakeSession,
): void {
	describe(label, () => {
		describe("construction (§1, §3, §6)", () => {
			test("starts in responding(0) (§3, §6)", () => {
				const { settings, script } = makeFixture(2, {
					letter: [true, false, true],
				});
				const session = make(settings, script);
				expect(session.snapshot().phase).toEqual({
					kind: "responding",
					trial: 0,
				});
			});

			test("totalTrials = n + problemCount (§1)", () => {
				const { settings, script } = makeFixture(2, {
					letter: [true, false, true],
				});
				const session = make(settings, script);
				expect(session.totalTrials).toBe(5);
				expect(session.settings).toEqual(settings);
			});

			test("exposes the fixed sequence with length totalTrials (§3)", () => {
				const { settings, script } = makeFixture(2, {
					letter: [true, false, true],
				});
				const session = make(settings, script);
				expect(session.sequence).toHaveLength(session.totalTrials);
				expect(session.sequence).toEqual(script.sequence);
			});
		});

		describe("memorization trials t < n (§1, §2)", () => {
			test("respond is a no-op: responses stay all false (§1, §3)", () => {
				const { settings, script } = makeFixture(2, { letter: [true] });
				const session = make(settings, script);
				session.respond("letter");
				const snap = session.snapshot();
				expect(snap.phase).toEqual({ kind: "responding", trial: 0 });
				expect(snap.responses).toEqual({ letter: false });
			});

			test("feedback(t) occurs but judgments === undefined (§1, §2)", () => {
				const { settings, script } = makeFixture(2, { letter: [true] });
				const session = make(settings, script);
				for (let t = 0; t < settings.n; t += 1) {
					session.closeTrial();
					const snap = session.snapshot();
					expect(snap.phase).toEqual({ kind: "feedback", trial: t });
					expect(snap.judgments).toBeUndefined();
					session.nextTrial();
				}
			});

			test("memorization input never leaks into the first scored trial (§1)", () => {
				const { settings, script } = makeFixture(1, { letter: [true] });
				const session = make(settings, script);
				session.respond("letter"); // responding(0), memorization: ignored
				session.closeTrial();
				session.respond("letter"); // feedback(0): ignored (§2)
				session.nextTrial(); // responding(1), scored
				expect(session.snapshot().responses).toEqual({ letter: false });
				session.closeTrial();
				// Trial 1 matches; with no surviving response it must be a miss.
				expect(session.snapshot().judgments).toEqual({ letter: "miss" });
			});
		});

		describe("scored trial responses (§2, §3)", () => {
			test("respond toggles on and a second respond cancels (§2)", () => {
				const { settings, script } = makeFixture(1, { letter: [true] });
				const session = make(settings, script);
				skipTrials(session, 1); // responding(1), scored
				session.respond("letter");
				expect(session.snapshot().responses).toEqual({ letter: true });
				session.respond("letter");
				expect(session.snapshot().responses).toEqual({ letter: false });
			});

			test("respond for a non-enabled modality is a no-op (§3)", () => {
				const { settings, script } = makeFixture(1, { letter: [true] });
				const session = make(settings, script);
				skipTrials(session, 1);
				session.respond("color");
				session.respond("position");
				expect(session.snapshot().responses).toEqual({ letter: false });
			});

			test("toggle state is visible only during responding (§3)", () => {
				const { settings, script } = makeFixture(1, { letter: [true] });
				const session = make(settings, script);
				skipTrials(session, 1);
				session.respond("letter");
				expect(session.snapshot().responses).toEqual({ letter: true });
				session.closeTrial();
				// §3 exposes the toggle state only during responding(t), t >= n.
				expect(session.snapshot().responses).toEqual({ letter: false });
			});

			test("the toggle state at closeTrial is the final answer (§2)", () => {
				const { settings, script } = makeFixture(1, { letter: [true, true] });
				const session = make(settings, script);
				skipTrials(session, 1);
				session.respond("letter"); // left toggled on: counts as "match"
				session.closeTrial();
				expect(session.snapshot().judgments).toEqual({ letter: "hit" });
				session.nextTrial();
				session.respond("letter");
				session.respond("letter"); // cancelled before close: no response
				session.closeTrial();
				expect(session.snapshot().judgments).toEqual({ letter: "miss" });
			});
		});

		describe("event table (§3)", () => {
			test("closeTrial in feedback is a no-op (no re-judging, no re-tally) (§3)", () => {
				const { settings, script } = makeFixture(1, { letter: [true, false] });
				const session = make(settings, script);
				skipTrials(session, 1);
				session.respond("letter");
				session.closeTrial(); // feedback(1): hit tallied once
				const before = session.snapshot();
				session.closeTrial();
				expect(session.snapshot()).toEqual(before);
				expect(session.snapshot().tallies.letter).toEqual({
					hit: 1,
					miss: 0,
					falseAlarm: 0,
					correctRejection: 0,
				});
			});

			test("nextTrial in responding is a no-op (§3)", () => {
				const { settings, script } = makeFixture(1, { letter: [true] });
				const session = make(settings, script);
				const initial = session.snapshot();
				session.nextTrial();
				expect(session.snapshot()).toEqual(initial);
				skipTrials(session, 1);
				session.respond("letter");
				const scored = session.snapshot();
				session.nextTrial();
				expect(session.snapshot()).toEqual(scored);
			});

			test("respond in feedback is a no-op: judged answer fixed, next trial clean (§2, §3)", () => {
				const { settings, script } = makeFixture(1, { letter: [true, false] });
				const session = make(settings, script);
				skipTrials(session, 1);
				session.respond("letter");
				session.closeTrial(); // feedback(1): judged as hit
				const judged = session.snapshot();
				expect(judged.judgments).toEqual({ letter: "hit" });
				session.respond("letter"); // ignored: answers are locked (§2)
				expect(session.snapshot()).toEqual(judged);
				session.nextTrial(); // responding(2)
				expect(session.snapshot().responses).toEqual({ letter: false });
			});

			test("after the last trial's feedback, nextTrial enters done (§2, §3)", () => {
				const { settings, script } = makeFixture(1, { letter: [true] });
				const session = make(settings, script);
				skipTrials(session, 1);
				session.closeTrial();
				expect(session.snapshot().phase).toEqual({
					kind: "feedback",
					trial: 1,
				});
				session.nextTrial();
				expect(session.snapshot().phase).toEqual({ kind: "done" });
			});

			test("all events (respond/closeTrial/nextTrial) are no-ops in done (§2, §3)", () => {
				const { settings, script } = makeFixture(1, { letter: [true, false] });
				const session = make(settings, script);
				runToDone(session);
				const done = session.snapshot();
				expect(done.phase).toEqual({ kind: "done" });
				expect(done.responses).toEqual({ letter: false });
				session.respond("letter");
				expect(session.snapshot()).toEqual(done);
				session.closeTrial();
				expect(session.snapshot()).toEqual(done);
				session.nextTrial();
				expect(session.snapshot()).toEqual(done);
			});
		});

		describe("judgments (§7)", () => {
			test("the (match, response) cross yields all four outcomes (§7)", () => {
				const { settings, script } = makeFixture(1, {
					letter: [true, true, false, false],
				});
				const session = make(settings, script);
				skipTrials(session, 1);
				const plan: readonly (readonly [boolean, Judgment])[] = [
					[true, "hit"], // match, responded
					[false, "miss"], // match, no response
					[true, "falseAlarm"], // no match, responded
					[false, "correctRejection"], // no match, no response
				];
				for (const [respond, expected] of plan) {
					if (respond) {
						session.respond("letter");
					}
					session.closeTrial();
					expect(session.snapshot().judgments).toEqual({ letter: expected });
					session.nextTrial();
				}
			});

			test("judgments exist only during feedback(t) with t >= n (§2, §3)", () => {
				const { settings, script } = makeFixture(1, { letter: [true] });
				const session = make(settings, script);
				expect(session.snapshot().judgments).toBeUndefined(); // responding(0)
				session.closeTrial();
				expect(session.snapshot().judgments).toBeUndefined(); // memorization feedback
				session.nextTrial();
				expect(session.snapshot().judgments).toBeUndefined(); // responding(1), scored
				session.closeTrial();
				expect(session.snapshot().judgments).toEqual({ letter: "miss" }); // feedback(1)
				session.nextTrial();
				expect(session.snapshot().judgments).toBeUndefined(); // done
			});
		});

		describe("tallies (§7)", () => {
			test("tallies accumulate across scored trials (§7)", () => {
				const { settings, script } = makeFixture(1, {
					letter: [true, true, false, false],
				});
				const session = make(settings, script);
				expect(session.snapshot().tallies).toEqual({
					letter: { hit: 0, miss: 0, falseAlarm: 0, correctRejection: 0 },
				});
				skipTrials(session, 1);
				session.respond("letter"); // hit
				session.closeTrial();
				expect(session.snapshot().tallies).toEqual({
					letter: { hit: 1, miss: 0, falseAlarm: 0, correctRejection: 0 },
				});
				session.nextTrial();
				session.closeTrial(); // miss
				expect(session.snapshot().tallies).toEqual({
					letter: { hit: 1, miss: 1, falseAlarm: 0, correctRejection: 0 },
				});
				session.nextTrial();
				session.respond("letter"); // falseAlarm
				session.closeTrial();
				session.nextTrial();
				session.closeTrial(); // correctRejection
				session.nextTrial();
				const done = session.snapshot();
				expect(done.phase).toEqual({ kind: "done" });
				expect(done.tallies).toEqual({
					letter: { hit: 1, miss: 1, falseAlarm: 1, correctRejection: 1 },
				});
			});

			test("at done, H+M+F+C === problemCount per enabled modality (§7)", () => {
				const { settings, script } = makeFixture(2, {
					letter: [true, false, true],
					color: [false, false, true],
				});
				const session = make(settings, script);
				skipTrials(session, settings.n);
				for (let i = 0; i < settings.problemCount; i += 1) {
					if (i % 2 === 0) {
						session.respond("letter");
					}
					if (i % 3 === 0) {
						session.respond("color");
					}
					session.closeTrial();
					session.nextTrial();
				}
				const done = session.snapshot();
				expect(done.phase).toEqual({ kind: "done" });
				for (const m of settings.modalities) {
					const tally = done.tallies[m];
					if (tally === undefined) {
						throw new Error(`missing tally for ${m}`);
					}
					expect(
						tally.hit + tally.miss + tally.falseAlarm + tally.correctRejection,
					).toBe(settings.problemCount);
				}
			});

			test("tallies are independent per modality (§4, §7)", () => {
				// Trial 1: letter matches, color matches; respond letter only.
				// Trial 2: letter differs, color matches; respond letter only.
				const { settings, script } = makeFixture(1, {
					letter: [true, false],
					color: [true, true],
				});
				const session = make(settings, script);
				skipTrials(session, 1);
				session.respond("letter");
				session.closeTrial();
				expect(session.snapshot().judgments).toEqual({
					letter: "hit",
					color: "miss",
				});
				session.nextTrial();
				session.respond("letter");
				session.closeTrial();
				expect(session.snapshot().judgments).toEqual({
					letter: "falseAlarm",
					color: "miss",
				});
				session.nextTrial();
				expect(session.snapshot().tallies).toEqual({
					letter: { hit: 1, miss: 0, falseAlarm: 1, correctRejection: 0 },
					color: { hit: 0, miss: 2, falseAlarm: 0, correctRejection: 0 },
				});
			});

			test("kappas hold one numeric entry per enabled modality at done (§3, §7)", () => {
				const { settings, script } = makeFixture(1, {
					letter: [true, false],
					color: [false, true],
				});
				const session = make(settings, script);
				runToDone(session);
				const { kappas } = session.snapshot();
				expect(Object.keys(kappas).sort()).toEqual(
					[...settings.modalities].sort(),
				);
				for (const m of settings.modalities) {
					expect(typeof kappas[m]).toBe("number");
				}
			});
		});

		describe("snapshot value semantics (§3)", () => {
			test("a snapshot taken before an event is not mutated by it (§3)", () => {
				const { settings, script } = makeFixture(1, { letter: [true, false] });
				const session = make(settings, script);
				skipTrials(session, 1);
				session.respond("letter");
				const saved = session.snapshot();
				const frozen = structuredClone(saved);
				session.respond("letter");
				session.closeTrial();
				session.nextTrial();
				session.respond("letter");
				session.closeTrial();
				expect(saved).toEqual(frozen);
			});
		});

		describe("stimulus exposure (§3)", () => {
			test("stimulus equals sequence[t] in responding(t) and feedback(t); absent in done (§3)", () => {
				const { settings, script } = makeFixture(2, {
					letter: [true, false],
					color: [false, true],
				});
				const session = make(settings, script);
				for (let t = 0; t < session.totalTrials; t += 1) {
					expect(session.snapshot().stimulus).toEqual(at(session.sequence, t));
					session.closeTrial();
					expect(session.snapshot().stimulus).toEqual(at(session.sequence, t));
					session.nextTrial();
				}
				const done = session.snapshot();
				expect(done.phase).toEqual({ kind: "done" });
				expect(done.stimulus).toBeUndefined();
			});
		});

		describe("determinism (§3)", () => {
			test("same settings + script + events give identical snapshots at every step (§3)", () => {
				const { settings, script } = makeFixture(2, {
					letter: [true, false, true],
					color: [false, true, true],
				});
				const a = make(settings, script);
				const b = make(settings, script);
				const events: readonly ((s: Session) => void)[] = [
					(s) => s.respond("letter"), // memorization: ignored
					(s) => s.closeTrial(),
					(s) => s.nextTrial(),
					(s) => s.closeTrial(),
					(s) => s.nextTrial(), // responding(2): first scored trial
					(s) => s.respond("letter"),
					(s) => s.respond("color"),
					(s) => s.respond("color"), // cancel
					(s) => s.closeTrial(),
					(s) => s.respond("letter"), // ignored in feedback
					(s) => s.nextTrial(),
					(s) => s.respond("color"),
					(s) => s.closeTrial(),
					(s) => s.nextTrial(),
					(s) => s.closeTrial(),
					(s) => s.nextTrial(), // done
					(s) => s.closeTrial(), // ignored in done
				];
				expect(a.sequence).toEqual(b.sequence);
				expect(a.snapshot()).toEqual(b.snapshot());
				for (const event of events) {
					event(a);
					event(b);
					expect(a.snapshot()).toEqual(b.snapshot());
				}
				expect(a.snapshot().phase).toEqual({ kind: "done" });
			});
		});

		describe("multi-modality (§4)", () => {
			test("per-modality responses can differ on the same trial (§4)", () => {
				const { settings, script } = makeFixture(1, {
					letter: [true],
					color: [false],
				});
				const session = make(settings, script);
				skipTrials(session, 1);
				session.respond("letter"); // respond letter, leave color untouched
				expect(session.snapshot().responses).toEqual({
					letter: true,
					color: false,
				});
				session.closeTrial();
				expect(session.snapshot().judgments).toEqual({
					letter: "hit",
					color: "correctRejection",
				});
			});
		});
	});
}
