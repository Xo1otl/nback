// localStorage boundary parser: per-element shape check + version-aware migration to SESSION_RECORD_VERSION.
// Persisted shapes (git history: game/_types.ts, storage/_store.ts):
//   v3  { record: { version: 3, …, origin }, savedAt } — wrapper; responded events carry `result`
//   v4  bare record, origin→createdAt (epoch ms); responded events carry `result`
//   v5  bare record; responded events carry `reason` only

import * as game from "@/game";

export type ParsedSessions = {
	readonly records: game.SessionRecord[];
	readonly dropped: number;
};

/** Unknown/corrupt elements dropped, count reported; non-array root → empty. */
export function parseSessions(parsed: unknown): ParsedSessions {
	if (!Array.isArray(parsed)) return { records: [], dropped: 0 };
	const records: game.SessionRecord[] = [];
	let dropped = 0;
	for (const element of parsed) {
		const record = toCurrentRecord(element);
		if (record === null) dropped += 1;
		else records.push(record);
	}
	return { records, dropped };
}

function toCurrentRecord(element: unknown): game.SessionRecord | null {
	if (!isObject(element)) return null;
	let candidate: Record<string, unknown> | null = element;
	if ("record" in candidate) candidate = liftV3(candidate);
	if (candidate !== null && candidate.version === 4) {
		candidate = {
			...candidate,
			version: 5,
			events: eventsWithoutResult(candidate.events),
		};
	}
	return candidate !== null && isSessionRecord(candidate) ? candidate : null;
}

/** v3 wrapper → v4 bare. `origin` was performance.now()-based (not epoch) → wrapper's `savedAt` (epoch ms) is the provable createdAt. */
function liftV3(x: Record<string, unknown>): Record<string, unknown> | null {
	if (
		!isObject(x.record) ||
		x.record.version !== 3 ||
		typeof x.savedAt !== "number"
	) {
		return null;
	}
	const { origin: _origin, ...record } = x.record;
	return { ...record, version: 4, createdAt: x.savedAt };
}

/** v4→v5: responded events persist `reason` only; `result` derives via resultOf. */
function eventsWithoutResult(events: unknown): unknown {
	if (!Array.isArray(events)) return events;
	return events.map((e) => {
		if (!isObject(e) || e.type !== "responded" || !("result" in e)) return e;
		const { result: _result, ...rest } = e;
		return rest;
	});
}

function isObject(x: unknown): x is Record<string, unknown> {
	return typeof x === "object" && x !== null;
}

// SYNC: game.ReasonCode literal union.
const REASONS = new Set<unknown>([
	"",
	"notResponding",
	"memoTrial",
	"modNotEnabled",
	"outsideWindow",
] satisfies game.ReasonCode[]);

function isEvent(x: unknown): x is game.Event {
	if (!isObject(x) || typeof x.offset !== "number") return false;
	if (x.type === "trialClosed" || x.type === "trialAdvanced") return true;
	return (
		x.type === "responded" &&
		typeof x.mod === "string" &&
		(x.action === "engage" || x.action === "disengage") &&
		REASONS.has(x.reason)
	);
}

function isModStimulus(x: unknown): x is game.ModStimulus {
	return isObject(x) && typeof x.mod === "string" && typeof x.value === "string";
}

function isTrialStimulus(x: unknown): x is game.TrialStimulus {
	return (
		isObject(x) &&
		typeof x.trial === "number" &&
		Array.isArray(x.values) &&
		x.values.every(isModStimulus)
	);
}

function isModConfig(x: unknown): x is game.ModConfig {
	return (
		isObject(x) &&
		typeof x.mod === "string" &&
		Array.isArray(x.options) &&
		x.options.every((o) => typeof o === "string")
	);
}

function isTiming(x: unknown): x is game.TimingConfig {
	return (
		isObject(x) &&
		typeof x.respondingDuration === "number" &&
		typeof x.feedbackDuration === "number"
	);
}

function isSpec(x: unknown): x is game.SessionSpec {
	return (
		isObject(x) &&
		typeof x.n === "number" &&
		typeof x.problemCount === "number" &&
		typeof x.matchProbability === "number" &&
		isTiming(x.timing) &&
		Array.isArray(x.mods) &&
		x.mods.every(isModConfig)
	);
}

function isSessionRecord(x: Record<string, unknown>): x is game.SessionRecord {
	return (
		x.version === game.SESSION_RECORD_VERSION &&
		typeof x.id === "string" &&
		isSpec(x.spec) &&
		typeof x.seed === "string" &&
		Array.isArray(x.stimuli) &&
		x.stimuli.every(isTrialStimulus) &&
		typeof x.createdAt === "number" &&
		Array.isArray(x.events) &&
		x.events.every(isEvent)
	);
}
