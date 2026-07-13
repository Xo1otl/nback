// coords assume `0 0 100 100` viewBox

import type { ShapeKind } from "@/lib/modalityTheme";

// --stim-outline (index.css): crisp edge both themes
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
