/** How each modality value is drawn (colors, shapes, animation), outcome pad skins, and key bindings. */

import type { ComponentType } from "react";
import { ArrowUp, Check, Minus, X } from "lucide-react";

import * as game from "@/game";

// HAZARD: stimulus fills must be fixed swatches, NOT theme tokens (those flip
// light/dark); these must read on both stage backgrounds.

export const STIM_COLORS: Record<string, string> = {
	[game.COLOR_RED]: "oklch(0.62 0.21 25)",
	[game.COLOR_GREEN]: "oklch(0.70 0.17 150)",
	[game.COLOR_PURPLE]: "oklch(0.58 0.24 300)",
	[game.COLOR_BLUE]: "oklch(0.55 0.19 255)",
};

const GLYPH_DARK = "oklch(0.16 0 0)";
const GLYPH_LIGHT = "oklch(0.98 0 0)";

/** Fill for a stimulus given its color value; muted when color is disabled or
 * unknown. */
export function fillFor(color: string | undefined): string {
	return STIM_COLORS[color ?? ""] ?? "var(--color-muted-foreground)";
}

/** Auto-contrast glyph color for the character drawn over a given fill. */
export function glyphFill(color: string | undefined): string {
	// green/muted fills are light → dark ink; saturated → light ink
	if (color === undefined || color === game.COLOR_GREEN) return GLYPH_DARK;
	return GLYPH_LIGHT;
}

/** A low-alpha halo (opposite of the glyph) for a paint-order legibility ring. */
export function glyphHalo(color: string | undefined): string {
	return glyphFill(color) === GLYPH_DARK
		? "oklch(1 0 0 / 0.55)"
		: "oklch(0 0 0 / 0.5)";
}

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
			// shape disabled → neutral carrier
			return "token";
	}
}

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

// outcome skins; feedback phase, pads only

export type OutcomeSkin = {
	readonly word: string;
	readonly className: string;
	readonly Icon: ComponentType<{ className?: string }>;
};

const SKINS: Record<game.Outcome, OutcomeSkin> = {
	H: {
		word: "Hit",
		className:
			"bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
		Icon: Check,
	},
	M: {
		word: "Miss",
		className:
			"bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
		Icon: ArrowUp,
	},
	F: {
		word: "False",
		className:
			"bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40",
		Icon: X,
	},
	C: {
		word: "Pass",
		className:
			"bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/40",
		Icon: Minus,
	},
};

export function outcomeSkin(o: game.Outcome): OutcomeSkin {
	return SKINS[o];
}

// INVARIANT: keys stable across mod subset. character=h (cHaracter); animation=m (Motion)

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
