/**
 * `storage` — local persistence of completed `game.SessionRecord`s.
 *
 * Import as a namespace: `import * as storage from "@/storage"`.
 */

export {
	deleteSession,
	deleteSessions,
	loadHistoryQuery,
	loadSessions,
	saveHistoryQuery,
	saveSession,
} from "./_store";
