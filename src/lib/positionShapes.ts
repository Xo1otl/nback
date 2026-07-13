import * as game from "@/game";

export type PositionShape = {
	readonly id: string;
	readonly label: string;
	// r{row}c{col} cells; k>=2, unique
	readonly options: game.OptionList;
};

const cell = game.positionCell;

// ordered hardest→easiest by cell count; 3x3 lattice
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

export function matchPositionShape(
	options: readonly game.Option[],
): PositionShape | undefined {
	const target = new Set(options);
	return POSITION_SHAPES.find(
		(s) => s.options.length === target.size && s.options.every((o) => target.has(o)),
	);
}
