/**
 * The single composite stimulus: ONE SVG node that simultaneously carries the
 * shape, color (fill + parity outline), character (auto-contrast glyph) and
 * animation channels. Position is handled by the parent (which cell it lands
 * in); audio is never drawn. A pure function of the trial's `stimulus.values`.
 */

import * as game from "@/game";
import { ShapeBody } from "@/components/ShapeBody";
import {
	animationClass,
	fillFor,
	glyphFill,
	glyphHalo,
	shapeKind,
} from "@/lib/modalityTheme";
import { cn } from "@/lib/utils";

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
