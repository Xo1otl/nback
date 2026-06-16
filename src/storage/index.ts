/**
 * `storage` — local persistence of completed `game.SessionRecord`s.
 *
 * Import as a namespace: `import * as storage from "@/storage"`.
 */

export {
	type StoredSession,
	loadSessions,
	saveSession,
	clearSessions,
	loadHistoryQuery,
	saveHistoryQuery,
} from "./_store";
