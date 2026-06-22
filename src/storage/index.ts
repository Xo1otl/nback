/**
 * `storage` — local persistence of completed `game.SessionRecord`s.
 */

export {
	deleteSession,
	deleteSessions,
	loadHistoryQuery,
	loadSessions,
	saveHistoryQuery,
	saveSession,
} from "./_store";
