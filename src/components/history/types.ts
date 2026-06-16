import type * as storage from "@/storage";

/** A stored session paired with its mean d′ (null only when no modality yields
 * a finite d′). The History screen scores each session once and threads this
 * down to the trend chart and the list rows. */
export type ScoredSession = {
	readonly stored: storage.StoredSession;
	readonly dp: number | null;
};
