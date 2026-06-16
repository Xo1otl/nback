/**
 * Local persistence for completed sessions. A `game.SessionRecord` is the SSOT
 * for a play-through (plain immutable values), so it serializes losslessly to
 * JSON; the `analysis` package projects scores from it on demand — storage
 * stays dumb and keeps only the record plus a save timestamp.
 *
 * Backed by `localStorage`. All access is defensive: missing/!window,
 * malformed JSON, and quota errors degrade to a no-op rather than throwing into
 * the UI.
 */

import type * as game from "@/game";

const KEY = "nback.sessions.v1";
const QUERY_KEY = "nback.historyQuery.v1";

/** A persisted play-through: the record plus when it was saved (epoch ms). */
export type StoredSession = {
	readonly record: game.SessionRecord;
	readonly savedAt: number;
};

/** Shallow shape check: enough that consumers can safely read `.record.spec`
 * and `.savedAt`. A corrupt/hand-edited/stale entry is dropped rather than
 * crashing the History screen — honors this module's "degrade to a no-op". */
function isStoredSession(e: unknown): e is StoredSession {
	if (typeof e !== "object" || e === null) return false;
	const { record, savedAt } = e as { record?: unknown; savedAt?: unknown };
	return (
		typeof savedAt === "number" &&
		typeof record === "object" &&
		record !== null &&
		"spec" in record
	);
}

function readRaw(): StoredSession[] {
	if (typeof localStorage === "undefined") return [];
	const raw = localStorage.getItem(KEY);
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter(isStoredSession) : [];
	} catch {
		return [];
	}
}

function writeRaw(sessions: readonly StoredSession[]): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(KEY, JSON.stringify(sessions));
	} catch {
		// Quota exceeded or storage disabled — drop silently; persistence is a
		// best-effort convenience, never a correctness dependency for play.
	}
}

/** All saved sessions in chronological order (oldest first), for trend lines. */
export function loadSessions(): StoredSession[] {
	return readRaw();
}

/**
 * Append a completed record and return its stored entry. `savedAt` is supplied
 * by the caller (the clock lives at the UI edge, not in this module).
 */
export function saveSession(
	record: game.SessionRecord,
	savedAt: number,
): StoredSession {
	const entry: StoredSession = { record, savedAt };
	writeRaw([...readRaw(), entry]);
	return entry;
}

/** Forget every saved session. */
export function clearSessions(): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.removeItem(KEY);
	} catch {
		// ignore
	}
}

/** The persisted History search query, or `null` if unset / unavailable. */
export function loadHistoryQuery(): string | null {
	if (typeof localStorage === "undefined") return null;
	const raw = localStorage.getItem(QUERY_KEY);
	return typeof raw === "string" ? raw : null;
}

/** Persist the History search query (best-effort; errors degrade to a no-op). */
export function saveHistoryQuery(query: string): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(QUERY_KEY, query);
	} catch {
		// ignore
	}
}
