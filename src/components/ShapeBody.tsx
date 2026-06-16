/**
 * The shape geometry for one stimulus, as SVG within a `0 0 100 100` viewBox.
 * A neutral, stateless primitive shared by the in-game `CompositeStimulus` and
 * the config `ShapePicker`, so the picker shows the exact in-game shapes without
 * the config area reaching into the game area for it.
 */

import type { ShapeKind } from "@/lib/modalityTheme";

// Theme-aware parity outline (`--stim-outline` in index.css): a light rim on the
// dark stage, a dark rim on the light stage, so every shape keeps a crisp edge
// against the current stage background in both themes.
const OUTLINE = "var(--stim-outline)";

export function ShapeBody({ kind, fill }: { kind: ShapeKind; fill: string }) {
	const common = {
		fill,
		stroke: OUTLINE,
		strokeWidth: 1.5,
		vectorEffect: "non-scaling-stroke" as const,
		strokeLinejoin: "round" as const,
	};
	switch (kind) {
		case "triangle":
			return <polygon points="50,14 86,84 14,84" {...common} />;
		case "square":
			return <rect x={17} y={17} width={66} height={66} rx={8} {...common} />;
		case "pentagon":
			return <polygon points="50,12 88,42 72,86 28,86 12,42" {...common} />;
		case "ellipse":
			return <ellipse cx={50} cy={50} rx={40} ry={33} {...common} />;
		default:
			return <rect x={18} y={18} width={64} height={64} rx={16} {...common} />;
	}
}
