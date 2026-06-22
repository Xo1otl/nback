/** Config validation & resolution (§Configuration). Materializes each mod's options (canonical defaults when omitted). */

import {
	CANONICAL_OPTIONS,
	type ModConfig,
	type ModID,
	type SessionConfig,
	type SessionSpec,
} from "./_types";

/** Thrown when a {@link SessionConfig} violates the §Configuration rules. */
export class ConfigError extends Error {
	override readonly name = "ConfigError";
}

export function validateAndResolveConfig(cfg: SessionConfig): SessionSpec {
	if (!Number.isInteger(cfg.n) || cfg.n < 1) {
		throw new ConfigError(`n must be an integer >= 1, got ${cfg.n}`);
	}
	if (!Number.isInteger(cfg.problemCount) || cfg.problemCount < 1) {
		throw new ConfigError(
			`problemCount must be an integer >= 1, got ${cfg.problemCount}`,
		);
	}
	if (!(cfg.matchProbability > 0 && cfg.matchProbability < 1)) {
		throw new ConfigError(
			`matchProbability must be in the open interval (0, 1), got ${cfg.matchProbability}`,
		);
	}
	if (!(cfg.timing.respondingDuration > 0)) {
		throw new ConfigError(
			`respondingDuration must be > 0, got ${cfg.timing.respondingDuration}`,
		);
	}
	if (!(cfg.timing.feedbackDuration >= 0)) {
		throw new ConfigError(
			`feedbackDuration must be >= 0, got ${cfg.timing.feedbackDuration}`,
		);
	}
	if (cfg.mods.length < 1) {
		throw new ConfigError("at least one modality must be enabled");
	}

	const seenMods = new Set<ModID>();
	const resolved: ModConfig[] = [];
	for (const mc of cfg.mods) {
		if (seenMods.has(mc.mod)) {
			throw new ConfigError(`duplicate modality: ${mc.mod}`);
		}
		seenMods.add(mc.mod);
		resolved.push({ mod: mc.mod, options: resolveOptions(mc) });
	}

	return {
		n: cfg.n,
		problemCount: cfg.problemCount,
		matchProbability: cfg.matchProbability,
		timing: cfg.timing,
		mods: resolved,
	};
}

function resolveOptions(mc: ModConfig): readonly string[] {
	const canonical = CANONICAL_OPTIONS[mc.mod];

	let options = mc.options;
	if (options.length === 0) {
		if (!canonical) {
			throw new ConfigError(
				`modality ${mc.mod} has no canonical default and requires explicit options`,
			);
		}
		options = canonical;
	}

	const seen = new Set<string>();
	for (const opt of options) {
		if (seen.has(opt)) {
			throw new ConfigError(`duplicate option "${opt}" in modality ${mc.mod}`);
		}
		seen.add(opt);
		if (canonical && !canonical.includes(opt)) {
			throw new ConfigError(
				`option "${opt}" is not in the canonical set for modality ${mc.mod}`,
			);
		}
	}

	if (options.length < 2) {
		throw new ConfigError(
			`modality ${mc.mod} needs at least 2 options, got ${options.length}`,
		);
	}

	return options;
}
