/**
 * The single default `SessionConfig` factory, shared by instant Play (top
 * screen) and the config form, so the two entry paths can never drift.
 */

import * as game from "@/game";

/** Modalities enabled by default — a calm, audio-free starting set. */
export const DEFAULT_MODS: readonly game.ModID[] = [
	game.MOD_POSITION,
	game.MOD_COLOR,
	game.MOD_CHARACTER,
];

/** A sensible, immediately-playable default session. */
export function defaultSessionConfig(): game.SessionConfig {
	const base = game.defaultMultiplexConfig(2, 20, 0.3, {
		respondingDuration: 2500,
		feedbackDuration: 600,
	});
	const keep = new Set(DEFAULT_MODS);
	return { ...base, mods: base.mods.filter((m) => keep.has(m.mod)) };
}
