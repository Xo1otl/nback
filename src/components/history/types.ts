import type * as game from "@/game";

/** Saved session + its mean d′ (null when no modality yields a finite d′). */
export type ScoredSession = {
	readonly record: game.SessionRecord;
	readonly dp: number | null;
};
