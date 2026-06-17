import type * as game from "@/game";

/** A saved session record paired with its mean d′ (null only when no modality
 * yields a finite d′). The History screen scores each session once and threads
 * this down to the trend chart and the list rows. */
export type ScoredSession = {
	readonly record: game.SessionRecord;
	readonly dp: number | null;
};
