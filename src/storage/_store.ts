/**
 * Local persistence for completed sessions. A `game.SessionRecord` is the SSOT
 * for a play-through (plain immutable values, incl. its `createdAt` wall-clock
 * stamp), so it serializes losslessly to JSON; the `analysis` package projects
 * scores from it on demand — storage stays dumb and keeps only the records.
 *
 * Backed by `localStorage`. All access is defensive: missing/!window, malformed
 * JSON, and quota errors degrade to a no-op rather than throwing into the UI.
 */

import type * as game from "@/game";

const KEY = "nback.sessions.v1";
const QUERY_KEY = "nback.historyQuery.v1";

function readRaw(): game.SessionRecord[] {
	if (typeof localStorage === "undefined") return [];
	const raw = localStorage.getItem(KEY);
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		// We own every write; trust a parsed array as-is (no per-record shape check).
		return Array.isArray(parsed) ? (parsed as game.SessionRecord[]) : [];
	} catch {
		return [];
	}
}

function writeRaw(records: readonly game.SessionRecord[]): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(KEY, JSON.stringify(records));
	} catch {
		// Quota/disabled storage: drop silently. Persistence is best-effort, never required for play.
	}
}

/** All saved records in save order (oldest first), for trend lines. */
export function loadSessions(): game.SessionRecord[] {
	return readRaw();
}

/** Append a completed record (its `createdAt` is the play time). */
export function saveSession(record: game.SessionRecord): void {
	writeRaw([...readRaw(), record]);
}

/** Forget every saved session whose id is in `ids` (no-op for ids not present). */
export function deleteSessions(ids: readonly game.SessionID[]): void {
	const drop = new Set(ids);
	if (drop.size === 0) return;
	writeRaw(readRaw().filter((record) => !drop.has(record.id)));
}

/** Forget a single saved session by id (no-op if the id isn't present). */
export function deleteSession(id: game.SessionID): void {
	deleteSessions([id]);
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
