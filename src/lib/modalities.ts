/** Presentation metadata for modalities; `game` owns canonical IDs/options. */

import type { ComponentType } from "react";
import {
	LayoutGrid,
	Palette,
	Type,
	Shapes,
	Volume2,
	Sparkles,
} from "lucide-react";

import * as game from "@/game";

export type ModMeta = {
	readonly id: game.ModID;
	readonly label: string;
	readonly description: string;
	readonly Icon: ComponentType<{ className?: string }>;
};

const META: Record<string, ModMeta> = {
	[game.MOD_POSITION]: {
		id: game.MOD_POSITION,
		label: "Position",
		description: "Where on the grid it appears",
		Icon: LayoutGrid,
	},
	[game.MOD_COLOR]: {
		id: game.MOD_COLOR,
		label: "Color",
		description: "Its fill color",
		Icon: Palette,
	},
	[game.MOD_CHARACTER]: {
		id: game.MOD_CHARACTER,
		label: "Character",
		description: "The letter or digit shown",
		Icon: Type,
	},
	[game.MOD_SHAPE]: {
		id: game.MOD_SHAPE,
		label: "Shape",
		description: "Its outline shape",
		Icon: Shapes,
	},
	[game.MOD_AUDIO]: {
		id: game.MOD_AUDIO,
		label: "Audio",
		description: "The spoken letter (listen)",
		Icon: Volume2,
	},
	[game.MOD_ANIMATION]: {
		id: game.MOD_ANIMATION,
		label: "Animation",
		description: "How it moves",
		Icon: Sparkles,
	},
};

/** Display metadata for a modality; falls back to a sane default for unknowns. */
export function modMeta(id: game.ModID): ModMeta {
	return META[id] ?? { id, label: id, description: "", Icon: Sparkles };
}

/** Human label for one modality option value (used by the config pickers). */
export function optionLabel(mod: game.ModID, value: game.Option): string {
	switch (mod) {
		case game.MOD_COLOR:
		case game.MOD_SHAPE:
		case game.MOD_ANIMATION:
			return value.charAt(0).toUpperCase() + value.slice(1);
		default:
			return value;
	}
}

/** The known modalities, in their canonical presentation order. */
export const ALL_MODS: readonly game.ModID[] = [
	game.MOD_POSITION,
	game.MOD_COLOR,
	game.MOD_CHARACTER,
	game.MOD_SHAPE,
	game.MOD_AUDIO,
	game.MOD_ANIMATION,
];

/** `ids` in `ALL_MODS` order; unknowns sort last, lexical tiebreak (total/stable). */
function modsInOrder(ids: readonly game.ModID[]): game.ModID[] {
	const rank = (m: game.ModID): number => {
		const i = ALL_MODS.indexOf(m);
		return i >= 0 ? i : ALL_MODS.length;
	};
	return [...ids].sort(
		(a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0),
	);
}

/** A spec's active modality ids in canonical order. */
export function sortedModIds(spec: game.SessionSpec): game.ModID[] {
	return modsInOrder(spec.mods.map((m) => m.mod));
}
