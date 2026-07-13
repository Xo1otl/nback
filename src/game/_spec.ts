/** Config validation & resolution (§Configuration); materializes options (canonical defaults when omitted). */

import {
	CANONICAL_OPTIONS,
	type ModConfig,
	type ModID,
	type OptionList,
	type SessionConfig,
	type SessionSpec,
} from "./_types";

export const MIN_ENABLED_MODS = 1;
export const MIN_OPTIONS_PER_MOD = 2;

/** §Configuration violation; expected failure, returned (never thrown). */
export class ConfigError extends Error {
	override readonly name = "ConfigError";
}

export function validateAndResolveConfig(
	cfg: SessionConfig,
): SessionSpec | ConfigError {
	if (!Number.isInteger(cfg.n) || cfg.n < 1) {
		return new ConfigError(`n must be an integer >= 1, got ${cfg.n}`);
	}
	if (!Number.isInteger(cfg.problemCount) || cfg.problemCount < 1) {
		return new ConfigError(
			`problemCount must be an integer >= 1, got ${cfg.problemCount}`,
		);
	}
	if (!(cfg.matchProbability > 0 && cfg.matchProbability < 1)) {
		return new ConfigError(
			`matchProbability must be in the open interval (0, 1), got ${cfg.matchProbability}`,
		);
	}
	if (!(cfg.timing.respondingDuration > 0)) {
		return new ConfigError(
			`respondingDuration must be > 0, got ${cfg.timing.respondingDuration}`,
		);
	}
	if (!(cfg.timing.feedbackDuration >= 0)) {
		return new ConfigError(
			`feedbackDuration must be >= 0, got ${cfg.timing.feedbackDuration}`,
		);
	}
	if (cfg.mods.length < MIN_ENABLED_MODS) {
		return new ConfigError(
			`at least ${MIN_ENABLED_MODS} modality must be enabled`,
		);
	}

	const seenMods = new Set<ModID>();
	const resolved: ModConfig[] = [];
	for (const mc of cfg.mods) {
		if (seenMods.has(mc.mod)) {
			return new ConfigError(`duplicate modality: ${mc.mod}`);
		}
		seenMods.add(mc.mod);
		const options = resolveOptions(mc);
		if (options instanceof ConfigError) {
			return options;
		}
		resolved.push({ mod: mc.mod, options });
	}

	return {
		n: cfg.n,
		problemCount: cfg.problemCount,
		matchProbability: cfg.matchProbability,
		timing: cfg.timing,
		mods: resolved,
	};
}

function resolveOptions(mc: ModConfig): OptionList | ConfigError {
	const canonical = CANONICAL_OPTIONS[mc.mod];

	let options = mc.options;
	if (options.length === 0) {
		if (!canonical) {
			return new ConfigError(
				`modality ${mc.mod} has no canonical default and requires explicit options`,
			);
		}
		options = canonical;
	}

	const seen = new Set<string>();
	for (const opt of options) {
		if (seen.has(opt)) {
			return new ConfigError(
				`duplicate option "${opt}" in modality ${mc.mod}`,
			);
		}
		seen.add(opt);
		if (canonical && !canonical.includes(opt)) {
			return new ConfigError(
				`option "${opt}" is not in the canonical set for modality ${mc.mod}`,
			);
		}
	}

	if (options.length < MIN_OPTIONS_PER_MOD) {
		return new ConfigError(
			`modality ${mc.mod} needs at least ${MIN_OPTIONS_PER_MOD} options, got ${options.length}`,
		);
	}

	return options;
}
