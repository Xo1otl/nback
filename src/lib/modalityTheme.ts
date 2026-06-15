/**
 * Game-visual theme for the modalities — the single source for how each
 * modality value is *drawn* (stimulus colors, shape geometry, animation class),
 * how outcomes are skinned on the response pads, and the key bindings. Kept
 * separate from `lib/modalities.ts` (icons/labels/order) because this layer is
 * specific to the game screen's rendering.
 */

import type { ComponentType } from "react";
import { ArrowUp, Check, Minus, X } from "lucide-react";

import * as game from "@/game";

// ---- Stimulus colors -------------------------------------------------------
//
// The semantic `--primary` token is near-WHITE in this dark theme, so stimulus
// fills must NOT reuse semantic tokens — they are fixed, dark-stage-tuned
// swatches. Every shape also carries a light parity outline (see the renderer)
// so "black" never vanishes against the dark stage.

export const STIM_COLORS: Record<string, string> = {
	[game.COLOR_RED]: "oklch(0.62 0.21 25)",
	[game.COLOR_GREEN]: "oklch(0.70 0.17 150)",
	[game.COLOR_PURPLE]: "oklch(0.58 0.24 300)",
	[game.COLOR_BLACK]: "oklch(0.22 0 0)",
};

const GLYPH_DARK = "oklch(0.16 0 0)";
const GLYPH_LIGHT = "oklch(0.98 0 0)";

/** Fill for a stimulus given its color value; muted when color is disabled. */
export function fillFor(color: string | undefined): string {
	if (color === undefined) return "var(--color-muted-foreground)";
	return STIM_COLORS[color] ?? "var(--color-muted-foreground)";
}

/** Auto-contrast glyph color for the character drawn over a given fill. */
export function glyphFill(color: string | undefined): string {
	// Green and the muted (color-disabled) fill are light → dark ink; the
	// saturated/black fills are dark → light ink.
	if (color === undefined || color === game.COLOR_GREEN) return GLYPH_DARK;
	return GLYPH_LIGHT;
}

/** A low-alpha halo (opposite of the glyph) for a paint-order legibility ring. */
export function glyphHalo(color: string | undefined): string {
	return glyphFill(color) === GLYPH_DARK
		? "oklch(1 0 0 / 0.55)"
		: "oklch(0 0 0 / 0.5)";
}

// ---- Shapes ----------------------------------------------------------------

export type ShapeKind = "triangle" | "square" | "pentagon" | "ellipse" | "token";

export function shapeKind(shape: string | undefined): ShapeKind {
	switch (shape) {
		case game.SHAPE_TRIANGLE:
			return "triangle";
		case game.SHAPE_SQUARE:
			return "square";
		case game.SHAPE_PENTAGON:
			return "pentagon";
		case game.SHAPE_ELLIPSE:
			return "ellipse";
		default:
			// shape disabled → a neutral carrier token for the other channels.
			return "token";
	}
}

// ---- Animation -------------------------------------------------------------

export function animationClass(anim: string | undefined): string {
	switch (anim) {
		case game.ANIMATION_BLUR:
			return "stim-blur";
		case game.ANIMATION_FLYING:
			return "stim-fly";
		case game.ANIMATION_SCALING:
			return "stim-scale";
		case game.ANIMATION_ROTATION:
			return "stim-rotate";
		default:
			return "stim-none";
	}
}

// ---- Outcome skins (feedback phase, on the pads only) ----------------------

export type OutcomeSkin = {
	readonly word: string;
	readonly className: string;
	readonly Icon: ComponentType<{ className?: string }>;
};

// Literal keys (not the `OUTCOME_*` constants, whose type is the full union)
// so this satisfies `Record<Outcome, OutcomeSkin>`.
const SKINS: Record<game.Outcome, OutcomeSkin> = {
	H: {
		word: "Hit",
		className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
		Icon: Check,
	},
	M: {
		word: "Miss",
		className: "bg-amber-500/15 text-amber-300 border-amber-500/40",
		Icon: ArrowUp,
	},
	F: {
		word: "False",
		className: "bg-rose-500/15 text-rose-300 border-rose-500/40",
		Icon: X,
	},
	C: {
		word: "Pass",
		className: "bg-teal-500/15 text-teal-300 border-teal-500/40",
		Icon: Minus,
	},
};

export function outcomeSkin(o: game.Outcome): OutcomeSkin {
	return SKINS[o];
}

// ---- Key bindings ----------------------------------------------------------
//
// Stable per-modality keys so muscle memory holds regardless of which subset is
// enabled. `c`→color and `a`→audio take the obvious letters; character falls
// back to `h` (cHaracter) and animation to `m` (Motion).

export const KEY_FOR_MOD: Record<string, string> = {
	[game.MOD_POSITION]: "p",
	[game.MOD_COLOR]: "c",
	[game.MOD_CHARACTER]: "h",
	[game.MOD_SHAPE]: "s",
	[game.MOD_AUDIO]: "a",
	[game.MOD_ANIMATION]: "m",
};

/** Reverse lookup: key → modality id. */
export const MOD_FOR_KEY: Record<string, game.ModID> = Object.fromEntries(
	Object.entries(KEY_FOR_MOD).map(([mod, key]) => [key, mod]),
);

// ---- Position geometry -----------------------------------------------------

const POS_RE = /^r(\d+)c(\d+)$/;

/** Parse a `r{row}c{col}` position id into 0-based coordinates, or null. */
export function parsePosition(
	value: string | undefined,
): { row: number; col: number } | null {
	if (value === undefined) return null;
	const m = POS_RE.exec(value);
	if (!m || m[1] === undefined || m[2] === undefined) return null;
	return { row: Number(m[1]), col: Number(m[2]) };
}

/** Grid extent implied by a position modality's option ids (defaults to 1x1). */
export function gridDims(options: readonly string[]): {
	rows: number;
	cols: number;
} {
	let rows = 1;
	let cols = 1;
	for (const o of options) {
		const p = parsePosition(o);
		if (p) {
			rows = Math.max(rows, p.row + 1);
			cols = Math.max(cols, p.col + 1);
		}
	}
	return { rows, cols };
}
