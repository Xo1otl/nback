/**
 * Predefined "shapes" for the position modality.
 *
 * Position options are grid-cell ids (`r{row}c{col}`). The `game` package
 * intentionally has no canonical set for them (they're grid-dependent and
 * free-form), so rather than expose arbitrary coordinates in the UI we offer a
 * curated set of recognizable arrangements. Each shape is just an `OptionList`
 * of cells on a small lattice, so it drops straight into a `ModConfig`; the
 * grid extent is derived from the ids (see `gridDims`) and the Stage lights
 * only the shape's cells, so the figure emerges as you play.
 */

import * as game from "@/game";

export type PositionShape = {
	readonly id: string;
	readonly label: string;
	/** Cells the stimulus can occupy, as `r{row}c{col}` ids (k >= 2, unique). */
	readonly options: game.OptionList;
};

const cell = (row: number, col: number): game.Option => `r${row}c${col}`;

/**
 * Curated arrangements, ordered roughly hardest → easiest by cell count (more
 * cells = more positions to track). All live on a 3x3 lattice.
 */
export const POSITION_SHAPES: readonly PositionShape[] = [
	{
		id: "grid",
		label: "Grid",
		options: [
			cell(0, 0), cell(0, 1), cell(0, 2),
			cell(1, 0), cell(1, 1), cell(1, 2),
			cell(2, 0), cell(2, 1), cell(2, 2),
		],
	},
	{
		id: "ring",
		label: "Ring",
		options: [
			cell(0, 0), cell(0, 1), cell(0, 2),
			cell(1, 2),
			cell(2, 2), cell(2, 1), cell(2, 0),
			cell(1, 0),
		],
	},
	{
		id: "diagonals",
		label: "Diagonals",
		options: [
			cell(0, 0), cell(0, 2),
			cell(1, 1),
			cell(2, 0), cell(2, 2),
		],
	},
	{
		id: "plus",
		label: "Plus",
		options: [
			cell(0, 1),
			cell(1, 0), cell(1, 1), cell(1, 2),
			cell(2, 1),
		],
	},
	{
		id: "corners",
		label: "Corners",
		options: [cell(0, 0), cell(0, 2), cell(2, 0), cell(2, 2)],
	},
	{
		id: "diamond",
		label: "Diamond",
		options: [cell(0, 1), cell(1, 0), cell(1, 2), cell(2, 1)],
	},
];

export const DEFAULT_POSITION_SHAPE: PositionShape = POSITION_SHAPES[0]!;

/** The shape whose cell set equals `options` (order-insensitive), or undefined. */
export function matchPositionShape(
	options: readonly game.Option[],
): PositionShape | undefined {
	const target = new Set(options);
	return POSITION_SHAPES.find(
		(s) => s.options.length === target.size && s.options.every((o) => target.has(o)),
	);
}
