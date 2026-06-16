/**
 * The focal Stage: an aspect-square card that renders the position lattice and
 * the composite stimulus in the correct cell. Pure projection of the snapshot —
 * it shows the live stimulus only while `running`; in `ready` it shows a
 * neutral preview token (the real trial-0 stimulus must not leak), and during
 * `feedback` it de-emphasizes the just-seen stimulus.
 */

import { Volume2 } from "lucide-react";

import type * as driver from "@/driver";
import * as game from "@/game";
import { CompositeStimulus } from "@/components/game/CompositeStimulus";
import { parsePosition } from "@/lib/modalityTheme";
import { cn } from "@/lib/utils";

export type Grid = { rows: number; cols: number; enabled: boolean };

function StimulusContent({
	stimulus,
	dim,
}: {
	stimulus: game.TrialStimulus;
	dim: boolean;
}) {
	return (
		<div
			className={cn(
				"aspect-square w-[68%] transition-opacity duration-150",
				dim && "opacity-60",
			)}
		>
			<CompositeStimulus stimulus={stimulus} />
		</div>
	);
}

export function Stage({
	snapshot,
	grid,
	audioEnabled,
	speakPulse,
}: {
	snapshot: driver.SessionSnapshot;
	grid: Grid;
	audioEnabled: boolean;
	speakPulse: number;
}) {
	const { status, phase, scored, stimulus } = snapshot;
	const liveStim = status === "running" ? stimulus : undefined;
	const dim = phase === "feedback";
	const memorize = status === "running" && phase === "responding" && !scored;

	const active = liveStim
		? parsePosition(game.trialStimulusValue(liveStim, game.MOD_POSITION))
		: null;
	const cellContent = liveStim ? (
		<StimulusContent stimulus={liveStim} dim={dim} />
	) : null;

	return (
		<div
			className={cn(
				// Constant 2px border width so the memorize→scored toggle changes
				// only color/style, never layout (avoids a 1px grid reflow).
				"relative aspect-square w-full overflow-hidden rounded-xl border-2 border-border bg-card/40",
				memorize && "border-dashed border-muted-foreground/40",
			)}
		>
			{/* Neutral preview token before the session starts. */}
			{status === "idle" && (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div className="size-24 rounded-2xl border border-dashed border-border bg-muted/30" />
				</div>
			)}

			{grid.enabled ? (
				<div
					className="grid size-full gap-1.5 p-2"
					style={{
						gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
						gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
					}}
				>
					{Array.from({ length: grid.rows * grid.cols }, (_, i) => {
						const row = Math.floor(i / grid.cols);
						const col = i % grid.cols;
						const isActive =
							active !== null && active.row === row && active.col === col;
						return (
							<div
								key={i}
								className="relative flex items-center justify-center overflow-hidden rounded-md border border-border/30"
							>
								{isActive && cellContent}
							</div>
						);
					})}
				</div>
			) : (
				<div className="flex size-full items-center justify-center overflow-hidden p-4">
					{cellContent}
				</div>
			)}

			{memorize && (
				<span className="pointer-events-none absolute right-3 top-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
					memorize
				</span>
			)}

			{audioEnabled && (
				<Volume2
					key={speakPulse}
					className={cn(
						"absolute bottom-3 left-3 size-4 text-muted-foreground/50",
						speakPulse >= 0 && "chrome-pulse",
					)}
					aria-hidden
				/>
			)}
		</div>
	);
}
