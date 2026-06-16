/**
 * The single composite stimulus: ONE SVG node that simultaneously carries the
 * shape, color (fill + parity outline), character (auto-contrast glyph) and
 * animation channels. Position is handled by the parent (which cell it lands
 * in); audio is never drawn. A pure function of the trial's `stimulus.values`.
 */

import * as game from "@/game";
import {
	animationClass,
	fillFor,
	glyphFill,
	glyphHalo,
	shapeKind,
	type ShapeKind,
} from "@/lib/modalityTheme";
import { cn } from "@/lib/utils";

// Theme-aware parity outline: a light rim on the dark stage, a dark rim on the
// light stage (defined as `--stim-outline` in index.css) so every shape keeps a
// crisp edge against the current stage background in both themes.
const OUTLINE = "var(--stim-outline)";

/** The shape geometry, as SVG within a `0 0 100 100` viewBox. Reused by the
 * config option chips so the picker shows the exact in-game shapes. */
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

export function CompositeStimulus({
	stimulus,
}: {
	stimulus: game.TrialStimulus;
}) {
	const color = game.trialStimulusValue(stimulus, game.MOD_COLOR);
	const char = game.trialStimulusValue(stimulus, game.MOD_CHARACTER);
	const shape = game.trialStimulusValue(stimulus, game.MOD_SHAPE);
	const anim = game.trialStimulusValue(stimulus, game.MOD_ANIMATION);

	const kind = shapeKind(shape);
	const isRotate = anim === game.ANIMATION_ROTATION;
	// The triangle's areal center sits below its bounding-box center, so nudge
	// the glyph down to keep it inside the slanted edges.
	const glyphY = kind === "triangle" ? 59 : 50;

	const glyph = char !== undefined && (
		<text
			x={50}
			y={glyphY}
			className="font-mono"
			fontSize={40}
			fontWeight={800}
			textAnchor="middle"
			dominantBaseline="central"
			fill={glyphFill(color)}
			stroke={glyphHalo(color)}
			strokeWidth={0.9}
			style={{ paintOrder: "stroke" }}
		>
			{char}
		</text>
	);

	return (
		<div className={cn("stim-wrap stim-rm-keep", animationClass(anim))}>
			<svg
				viewBox="0 0 100 100"
				className="block size-full overflow-visible"
				aria-hidden
			>
				<ShapeBody kind={kind} fill={fillFor(color)} />
				{isRotate ? (
					<g className="stim-rotate-rev stim-rm-keep">{glyph}</g>
				) : (
					glyph
				)}
			</svg>
		</div>
	);
}
