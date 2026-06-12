/**
 * Contract for the multiplex n-back game logic. Section references (§) point
 * to specs.md. This package is pure TypeScript and UI-framework-agnostic: it
 * holds no timers and never reads the clock (§3) — a driver dispatches events.
 */

// ---- Modalities and their option catalogs (§4) ----

export const MODALITIES = [
	"position",
	"color",
	"letter",
	"shape",
	"audio",
	"animation",
] as const;
export type Modality = (typeof MODALITIES)[number];

/** Cell index in row-major order (`row * cols + col`); k = rows * cols. */
export type PositionOption = number;

export const COLOR_OPTIONS = ["red", "green", "purple", "black"] as const;
export type ColorOption = (typeof COLOR_OPTIONS)[number];

// prettier-ignore
export const LETTER_OPTIONS = [
	"0",
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"A",
	"B",
	"C",
	"D",
	"E",
	"H",
	"K",
	"L",
	"M",
	"O",
] as const;
export type LetterOption = (typeof LETTER_OPTIONS)[number];

export const SHAPE_OPTIONS = [
	"triangle",
	"square",
	"pentagon",
	"ellipse",
] as const;
export type ShapeOption = (typeof SHAPE_OPTIONS)[number];

export const AUDIO_OPTIONS = ["A", "B", "C", "H", "K", "L", "M", "O"] as const;
export type AudioOption = (typeof AUDIO_OPTIONS)[number];

export const ANIMATION_OPTIONS = [
	"blur",
	"flying",
	"scaling",
	"rotation",
	"none",
] as const;
export type AnimationOption = (typeof ANIMATION_OPTIONS)[number];

export type OptionByModality = {
	readonly position: PositionOption;
	readonly color: ColorOption;
	readonly letter: LetterOption;
	readonly shape: ShapeOption;
	readonly audio: AudioOption;
	readonly animation: AnimationOption;
};

/** A map holding one value per enabled modality; disabled keys are absent. */
export type PerModality<T> = { readonly [M in Modality]?: T };

/**
 * One trial's stimulus: an independently drawn option per enabled modality
 * (§4). Keys are exactly the session's enabled modalities.
 */
export type Stimulus = { readonly [M in Modality]?: OptionByModality[M] };

// ---- Settings (§6) ----

export type GridSize = { readonly rows: number; readonly cols: number };

export type Settings = {
	/** N: integer >= 1. */
	readonly n: number;
	/** Number of scored trials: integer >= 1 (§1). */
	readonly problemCount: number;
	/** Non-empty, duplicate-free subset of MODALITIES (§4). */
	readonly modalities: readonly Modality[];
	/**
	 * Required iff "position" is enabled: integers rows, cols >= 1 with
	 * rows * cols >= 2 (§6).
	 */
	readonly grid?: GridSize;
	/** Minimum match probability p, 0 <= p <= 1 (§5). */
	readonly minMatchProbability: number;
	/** Driver-only (§6): duration of the responding phase, ms > 0. */
	readonly presentationMs: number;
	/** Driver-only (§6): duration of the feedback phase, ms >= 0. */
	readonly feedbackMs: number;
};

/** Thrown by session construction when settings violate §6 constraints. */
export class SettingsError extends Error {}

// ---- Session state machine (§2, §3) ----

export type Phase =
	| { readonly kind: "responding"; readonly trial: number }
	| { readonly kind: "feedback"; readonly trial: number }
	| { readonly kind: "done" };

export type Judgment = "hit" | "miss" | "falseAlarm" | "correctRejection";

/** Per-modality outcome counts over the scored trials judged so far (§7). */
export type Tally = {
	readonly hit: number;
	readonly miss: number;
	readonly falseAlarm: number;
	readonly correctRejection: number;
};

/**
 * Immutable view of the observable state (§3). Events that change state
 * produce a fresh snapshot value (safe to hold as React/Svelte state).
 */
export type Snapshot = {
	readonly phase: Phase;
	/** Trial `t`'s stimulus during responding(t)/feedback(t); absent in done. */
	readonly stimulus?: Stimulus;
	/**
	 * Toggle state per enabled modality (§2). All false except during
	 * responding(t) with t >= n, where respond(m) flips entries.
	 */
	readonly responses: PerModality<boolean>;
	/**
	 * Judgment of the current trial per enabled modality; present only during
	 * feedback(t) with t >= n (memorization trials have no judgment, §2).
	 */
	readonly judgments?: PerModality<Judgment>;
	/** Running tallies; hit+miss+falseAlarm+correctRejection grows to problemCount (§7). */
	readonly tallies: PerModality<Tally>;
	/** Cohen's kappa over `tallies` so far (§7); final values once done. */
	readonly kappas: PerModality<number>;
};

/**
 * A play-through under fixed settings (§1). Pure state machine: events are
 * total functions — out-of-phase events are no-ops, never errors (§3).
 */
export interface Session {
	readonly settings: Settings;
	/** n + problemCount (§1). */
	readonly totalTrials: number;
	/** Stimulus sequence fixed at construction (§3, §5); length = totalTrials. */
	readonly sequence: readonly Stimulus[];
	snapshot(): Snapshot;
	/**
	 * Toggle the current trial's answer for `modality` (§2). No-op unless in
	 * responding(t) with t >= n and `modality` is enabled (§3).
	 */
	respond(modality: Modality): void;
	/** responding(t) → feedback(t); no-op in feedback/done (§3). */
	closeTrial(): void;
	/** feedback(t) → responding(t+1), or done after the last trial; no-op otherwise (§3). */
	nextTrial(): void;
}

// ---- Construction and scoring (§5, §7) ----

/** Uniform random number in [0, 1). */
export type Rng = () => number;

export type SessionDeps = {
	/** Randomness for sequence generation (§5). Defaults to Math.random. */
	readonly rng?: Rng;
	/**
	 * Pre-built sequence for replay/testing (§3); takes precedence over `rng`.
	 * Must be length n + problemCount with exactly the enabled modalities set
	 * on every trial.
	 */
	readonly sequence?: readonly Stimulus[];
};

/**
 * Factory (§3, §6): validates settings (throws SettingsError), fixes the
 * stimulus sequence up front (§5), and returns the session in responding(0).
 */
export type NewSession = (settings: Settings, deps?: SessionDeps) => Session;

/**
 * Cohen's kappa of one modality's tally (§7). Defined as 0 when Pe = 1 and
 * when the tally is empty (no scored trial judged yet).
 */
export type ComputeKappa = (tally: Tally) => number;
