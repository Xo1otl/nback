/** Position Option codec SSOT: `r{row}c{col}`. Encode/decode/geometry live here only. */

import type { Option, OptionList } from "./_types";

export function positionCell(row: number, col: number): Option {
	return `r${row}c${col}`;
}

const POS_RE = /^r(\d+)c(\d+)$/;

export function parsePosition(
	option: Option | undefined,
): { row: number; col: number } | null {
	if (option === undefined) return null;
	const m = POS_RE.exec(option);
	if (!m || m[1] === undefined || m[2] === undefined) return null;
	return { row: Number(m[1]), col: Number(m[2]) };
}

/** Bounding grid of parseable options; min 1x1. */
export function positionGridDims(options: OptionList): {
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
