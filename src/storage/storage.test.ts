import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as game from "@/game";
import * as storage from "@/storage";

const KEY = "nback.sessions.v1";

function fakeLocalStorage(
	setItem?: (key: string, value: string) => void,
): Storage {
	const store = new Map<string, string>();
	return {
		get length() {
			return store.size;
		},
		clear: () => store.clear(),
		getItem: (key) => store.get(key) ?? null,
		key: (i) => [...store.keys()][i] ?? null,
		removeItem: (key) => {
			store.delete(key);
		},
		setItem: setItem ?? ((key, value) => store.set(key, value)),
	};
}

function installLocalStorage(fake: Storage): void {
	Object.defineProperty(globalThis, "localStorage", {
		value: fake,
		configurable: true,
		writable: true,
	});
}

function removeLocalStorage(): void {
	Reflect.deleteProperty(globalThis, "localStorage");
}

const SPEC: game.SessionSpec = {
	n: 1,
	problemCount: 2,
	matchProbability: 0.4,
	timing: { respondingDuration: 2000, feedbackDuration: 500 },
	mods: [{ mod: game.MOD_COLOR, options: [game.COLOR_RED, game.COLOR_GREEN] }],
};

const STIMULI: game.StimulusTrace = [
	{ trial: 0, values: [{ mod: game.MOD_COLOR, value: game.COLOR_RED }] },
	{ trial: 1, values: [{ mod: game.MOD_COLOR, value: game.COLOR_RED }] },
	{ trial: 2, values: [{ mod: game.MOD_COLOR, value: game.COLOR_GREEN }] },
];

const EVENTS: readonly game.Event[] = [
	{ type: "responded", offset: 2500, mod: game.MOD_COLOR, action: "engage", reason: "" },
	{ type: "trialClosed", offset: 4000 },
];

function record(id: string, createdAt = 1_700_000_000_000): game.SessionRecord {
	return game.newSessionRecord(id, SPEC, "seed", STIMULI, createdAt, EVENTS);
}

/** v4 persisted shape: bare record, responded events carry `result`. */
function v4Element(id: string): unknown {
	const r = record(id);
	return {
		...r,
		version: 4,
		events: r.events.map((e) =>
			e.type === "responded" ? { ...e, result: "accepted" } : e,
		),
	};
}

/** v3 persisted shape: StoredSession wrapper; record has perf-based `origin`, events carry `result`. */
function v3Element(id: string, savedAt: number): unknown {
	const { createdAt: _createdAt, ...bare } = record(id);
	const v4 = v4Element(id) as Record<string, unknown>;
	return {
		record: { ...bare, version: 3, origin: 1234.5, events: v4.events },
		savedAt,
	};
}

beforeEach(() => {
	installLocalStorage(fakeLocalStorage());
});
afterEach(() => {
	removeLocalStorage();
});

describe("storage save/load", () => {
	test("round-trips a record", () => {
		const r = record("a");
		expect(storage.saveSession(r)).toEqual({ ok: true });
		expect(storage.loadSessions()).toEqual([r]);
	});

	test("saveSession is idempotent per id: replaces in place, keeps order", () => {
		const a = record("a", 1);
		const b = record("b", 2);
		storage.saveSession(a);
		storage.saveSession(b);
		const a2 = { ...a, seed: "reseeded" };
		expect(storage.saveSession(a2)).toEqual({ ok: true });
		expect(storage.loadSessions()).toEqual([a2, b]);
	});

	test("deleteSessions removes by id", () => {
		storage.saveSession(record("a"));
		storage.saveSession(record("b"));
		storage.deleteSession("a");
		expect(storage.loadSessions().map((r) => r.id)).toEqual(["b"]);
	});
});

describe("storage migration", () => {
	test("v4 record: drops `result` from responded events, bumps version", () => {
		localStorage.setItem(KEY, JSON.stringify([v4Element("a")]));
		expect(storage.loadSessions()).toEqual([record("a")]);
	});

	test("v3 wrapper: unwraps, createdAt from savedAt, drops origin + result", () => {
		const savedAt = 1_650_000_000_000;
		localStorage.setItem(KEY, JSON.stringify([v3Element("a", savedAt)]));
		expect(storage.loadSessions()).toEqual([record("a", savedAt)]);
	});

	test("unmigratable elements dropped with one counted warn", () => {
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			localStorage.setItem(
				KEY,
				JSON.stringify([
					42,
					{ version: 99, id: "future" },
					{ record: { version: 3 }, savedAt: "not-a-number" },
					v4Element("keep"),
				]),
			);
			expect(storage.loadSessions().map((r) => r.id)).toEqual(["keep"]);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0]?.[0]).toContain("3");
		} finally {
			warn.mockRestore();
		}
	});

	test("malformed JSON / non-array root degrade to empty", () => {
		localStorage.setItem(KEY, "{not json");
		expect(storage.loadSessions()).toEqual([]);
		localStorage.setItem(KEY, JSON.stringify({ oops: true }));
		expect(storage.loadSessions()).toEqual([]);
	});
});

describe("storage save failures", () => {
	test("quota exceeded → { ok: false, reason: 'quota' }", () => {
		installLocalStorage(
			fakeLocalStorage(() => {
				throw new DOMException("full", "QuotaExceededError");
			}),
		);
		expect(storage.saveSession(record("a"))).toEqual({
			ok: false,
			reason: "quota",
		});
	});

	test("non-quota throw → { ok: false, reason: 'unavailable' }", () => {
		installLocalStorage(
			fakeLocalStorage(() => {
				throw new Error("denied");
			}),
		);
		expect(storage.saveSession(record("a"))).toEqual({
			ok: false,
			reason: "unavailable",
		});
	});

	test("no localStorage → { ok: false, reason: 'unavailable' }, reads empty", () => {
		removeLocalStorage();
		expect(storage.saveSession(record("a"))).toEqual({
			ok: false,
			reason: "unavailable",
		});
		expect(storage.loadSessions()).toEqual([]);
	});
});
