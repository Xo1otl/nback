/**
 * `storage` — local persistence of completed `game.SessionRecord`s.
 *
 * Import as a namespace: `import * as storage from "@/storage"`.
 */

export {
	loadSessions,
	saveSession,
	clearSessions,
	loadHistoryQuery,
	saveHistoryQuery,
} from "./_store";
