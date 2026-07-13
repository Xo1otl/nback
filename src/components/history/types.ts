import type * as game from "@/game";

// dp null when no modality yields finite d′
export type ScoredSession = {
	readonly record: game.SessionRecord;
	readonly dp: number | null;
};
