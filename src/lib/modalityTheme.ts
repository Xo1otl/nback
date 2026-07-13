import type { ComponentType } from "react";
import { ArrowUp, Check, Minus, X } from "lucide-react";

import * as game from "@/game";

// HAZARD: stimulus fills must be fixed swatches, NOT theme tokens (those flip
// light/dark); these must read on both stage backgrounds.

const STIM_COLORS: Record<string, string> = {
	[game.COLOR_RED]: "oklch(0.62 0.21 25)",
	[game.COLOR_GREEN]: "oklch(0.70 0.17 150)",
	[game.COLOR_PURPLE]: "oklch(0.58 0.24 300)",
	[game.COLOR_BLUE]: "oklch(0.55 0.19 255)",
};

const GLYPH_DARK = "oklch(0.16 0 0)";
const GLYPH_LIGHT = "oklch(0.98 0 0)";

export function fillFor(color: string | undefined): string {
	return STIM_COLORS[color ?? ""] ?? "var(--color-muted-foreground)";
}

export function glyphFill(color: string | undefined): string {
	// green/muted fills are light → dark ink; saturated → light ink
	if (color === undefined || color === game.COLOR_GREEN) return GLYPH_DARK;
	return GLYPH_LIGHT;
}

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
