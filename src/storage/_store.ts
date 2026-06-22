// INVARIANT: SessionRecord = plain immutable JSON-serializable SSOT; storage persists records verbatim, no projection.
// localStorage access defensive: missing/!window, bad JSON, quota → no-op.

import type * as game from "@/game";

const KEY = "nback.sessions.v1";
const QUERY_KEY = "nback.historyQuery.v1";

function readRaw(): game.SessionRecord[] {
	if (typeof localStorage === "undefined") return [];
	const raw = localStorage.getItem(KEY);
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		// HAZARD: no per-record shape check; trusts our own writes → SessionRecord schema change reads stale shapes unchecked.
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
	}
}

/** Saved records, append order (oldest first). */
export function loadSessions(): game.SessionRecord[] {
	return readRaw();
}

/** Append a record. */
export function saveSession(record: game.SessionRecord): void {
	writeRaw([...readRaw(), record]);
}

/** Delete sessions by id. */
export function deleteSessions(ids: readonly game.SessionID[]): void {
	const drop = new Set(ids);
	if (drop.size === 0) return;
	writeRaw(readRaw().filter((record) => !drop.has(record.id)));
}

/** Delete one session by id. */
export function deleteSession(id: game.SessionID): void {
	deleteSessions([id]);
}

/** The persisted History search query, or `null` if unset / unavailable. */
export function loadHistoryQuery(): string | null {
	if (typeof localStorage === "undefined") return null;
	const raw = localStorage.getItem(QUERY_KEY);
	return typeof raw === "string" ? raw : null;
}

/** Persist History search query. */
export function saveHistoryQuery(query: string): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(QUERY_KEY, query);
	} catch {
		// ignore
	}
}
