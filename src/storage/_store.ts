// INVARIANT: SessionRecord = plain immutable JSON-serializable SSOT; storage persists records verbatim, no projection.
// localStorage = untrusted boundary: reads parse + migrate per element (_parse); writes report SaveResult.

import type * as game from "@/game";
import { parseSessions } from "./_parse";

// Namespace, not schema version; shape versioning is per-record (record.version).
const KEY = "nback.sessions.v1";
const QUERY_KEY = "nback.historyQuery.v1";

export type SaveResult =
	| { ok: true }
	| { ok: false; reason: "quota" | "unavailable" };

function readRaw(): game.SessionRecord[] {
	if (typeof localStorage === "undefined") return [];
	const raw = localStorage.getItem(KEY);
	if (!raw) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}
	const { records, dropped } = parseSessions(parsed);
	if (dropped > 0) {
		console.warn(`storage: dropped ${dropped} unmigratable session record(s)`);
	}
	return records;
}

function isQuotaError(e: unknown): boolean {
	return (
		e instanceof DOMException &&
		(e.name === "QuotaExceededError" || e.code === 22)
	);
}

function writeRaw(records: readonly game.SessionRecord[]): SaveResult {
	if (typeof localStorage === "undefined") {
		return { ok: false, reason: "unavailable" };
	}
	try {
		localStorage.setItem(KEY, JSON.stringify(records));
		return { ok: true };
	} catch (e) {
		return { ok: false, reason: isQuotaError(e) ? "quota" : "unavailable" };
	}
}

/** append order, oldest first */
export function loadSessions(): game.SessionRecord[] {
	return readRaw();
}

/** Upsert by id: existing record replaced in place, else appended. */
export function saveSession(record: game.SessionRecord): SaveResult {
	const records = readRaw();
	const at = records.findIndex((r) => r.id === record.id);
	return writeRaw(at === -1 ? [...records, record] : records.with(at, record));
}

export function deleteSessions(ids: readonly game.SessionID[]): void {
	const drop = new Set(ids);
	if (drop.size === 0) return;
	writeRaw(readRaw().filter((record) => !drop.has(record.id)));
}

export function deleteSession(id: game.SessionID): void {
	deleteSessions([id]);
}

/** null if unset/unavailable */
export function loadHistoryQuery(): string | null {
	if (typeof localStorage === "undefined") return null;
	const raw = localStorage.getItem(QUERY_KEY);
	return typeof raw === "string" ? raw : null;
}

export function saveHistoryQuery(query: string): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(QUERY_KEY, query);
	} catch {
	}
}
