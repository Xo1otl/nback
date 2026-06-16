/**
 * Display copy for History filter conditions — the user-facing labels, the
 * "add" menu's section headings, and its grouping order. Kept out of the pure
 * `historyFilter` algebra (mirrors how `modalities.ts` owns modality display
 * strings rather than the `game` package).
 */

import type * as hf from "@/lib/historyFilter";
import { modMeta } from "@/lib/modalities";

/** Text label for a condition (also the accessible name for icon-only chips). */
export function conditionLabel(c: hf.Condition): string {
	switch (c.kind) {
		case "n":
			return `${c.n}-back`;
		case "mods":
			return c.mods.map((id) => modMeta(id).label).join(" · ");
		case "options":
			return `${modMeta(c.mod).label}: ${c.count} option${c.count === 1 ? "" : "s"}`;
		case "matchPct":
			return `${c.matchPct}% match`;
		case "respondingMs":
			return `${(c.ms / 1000).toFixed(1)}s / trial`;
		case "feedbackMs":
			return `${(c.ms / 1000).toFixed(1)}s feedback`;
	}
}

/** Section heading for the "add filter" menu. */
export function conditionKindLabel(kind: hf.ConditionKind): string {
	switch (kind) {
		case "n":
			return "Level";
		case "mods":
			return "Modalities";
		case "options":
			return "Options";
		case "matchPct":
			return "Match rate";
		case "respondingMs":
			return "Trial time";
		case "feedbackMs":
			return "Feedback time";
	}
}

/** Display/menu order of condition kinds. */
export const CONDITION_KINDS: readonly hf.ConditionKind[] = [
	"n",
	"mods",
	"options",
	"matchPct",
	"respondingMs",
	"feedbackMs",
];
