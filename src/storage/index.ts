/**
 * `storage` — local persistence of completed `game.SessionRecord`s.
 *
 * Import as a namespace: `import * as storage from "@/storage"`.
 */

export {
	clearSessions,
	deleteSession,
	loadHistoryQuery,
	loadSessions,
	saveHistoryQuery,
	saveSession,
} from "./_store";
