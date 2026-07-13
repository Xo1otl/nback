import * as game from "@/game";

// INVARIANT: keys stable across mod subset. character=h (cHaracter); animation=m (Motion)

export const KEY_FOR_MOD: Record<string, string> = {
	[game.MOD_POSITION]: "p",
	[game.MOD_COLOR]: "c",
	[game.MOD_CHARACTER]: "h",
	[game.MOD_SHAPE]: "s",
	[game.MOD_AUDIO]: "a",
	[game.MOD_ANIMATION]: "m",
};

export const MOD_FOR_KEY: Record<string, game.ModID> = Object.fromEntries(
	Object.entries(KEY_FOR_MOD).map(([mod, key]) => [key, mod]),
);
