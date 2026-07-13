import * as game from "@/game";

export const DEFAULT_MODS: readonly game.ModID[] = [
	game.MOD_POSITION,
	game.MOD_COLOR,
	game.MOD_CHARACTER,
];

export function matchPctOf(config: game.SessionConfig): number {
	return Math.round(config.matchProbability * 100);
}

export function matchProbabilityFromPct(pct: number): number {
	return pct / 100;
}

export function defaultSessionConfig(): game.SessionConfig {
	const base = game.defaultMultiplexConfig(2, 20, 0.3, {
		respondingDuration: 2500,
		feedbackDuration: 600,
	});
	const keep = new Set(DEFAULT_MODS);
	return { ...base, mods: base.mods.filter((m) => keep.has(m.mod)) };
}
