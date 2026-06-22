/** Default `SessionConfig` factory; shared by Play + config form. */

import * as game from "@/game";

/** Modalities enabled by default — a calm, audio-free starting set. */
export const DEFAULT_MODS: readonly game.ModID[] = [
	game.MOD_POSITION,
	game.MOD_COLOR,
	game.MOD_CHARACTER,
];

/** Match rate as whole percent. Inverse of {@link matchProbabilityFromPct}. */
export function matchPctOf(config: game.SessionConfig): number {
	return Math.round(config.matchProbability * 100);
}

/** A whole-percent match rate as the [0, 1] probability the domain expects. */
export function matchProbabilityFromPct(pct: number): number {
	return pct / 100;
}

/** A sensible, immediately-playable default session. */
export function defaultSessionConfig(): game.SessionConfig {
	const base = game.defaultMultiplexConfig(2, 20, 0.3, {
		respondingDuration: 2500,
		feedbackDuration: 600,
	});
	const keep = new Set(DEFAULT_MODS);
	return { ...base, mods: base.mods.filter((m) => keep.has(m.mod)) };
}
