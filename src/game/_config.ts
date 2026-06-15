/**
 * Convenience factory for the standard six-modality configuration
 * (port of Go's `DefaultMultiplexConfig`), with a 3x3 position grid.
 */

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

const DEFAULT_GRID: readonly Option[] = [
	"r0c0", "r0c1", "r0c2",
	"r1c0", "r1c1", "r1c2",
	"r2c0", "r2c1", "r2c2",
];

export function defaultMultiplexConfig(
	n: number,
	problemCount: number,
	match: Probability,
	timing: TimingConfig,
): SessionConfig {
	return {
		n,
		problemCount,
		matchProbability: match,
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
