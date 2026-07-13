import { positionCell } from "./_position";
import {
	CANONICAL_ANIMATION,
	CANONICAL_AUDIO,
	CANONICAL_CHARACTER,
	CANONICAL_COLOR,
	CANONICAL_SHAPE,
	MOD_ANIMATION,
	MOD_AUDIO,
	MOD_CHARACTER,
	MOD_COLOR,
	MOD_POSITION,
	MOD_SHAPE,
	type Option,
	type Probability,
	type SessionConfig,
	type TimingConfig,
} from "./_types";

// 3x3 lattice
const DEFAULT_GRID: readonly Option[] = [0, 1, 2].flatMap((row) =>
	[0, 1, 2].map((col) => positionCell(row, col)),
);

export function defaultMultiplexConfig(
	n: number,
	problemCount: number,
	matchProbability: Probability,
	timing: TimingConfig,
): SessionConfig {
	return {
		n,
		problemCount,
		matchProbability,
		timing,
		mods: [
			{ mod: MOD_POSITION, options: DEFAULT_GRID },
			{ mod: MOD_COLOR, options: CANONICAL_COLOR },
			{ mod: MOD_CHARACTER, options: CANONICAL_CHARACTER },
			{ mod: MOD_SHAPE, options: CANONICAL_SHAPE },
			{ mod: MOD_AUDIO, options: CANONICAL_AUDIO },
			{ mod: MOD_ANIMATION, options: CANONICAL_ANIMATION },
		],
	};
}
