import { Volume2 } from "lucide-react";

import * as game from "@/game";
import { ShapeBody } from "@/components/ShapeBody";
import { optionLabel } from "@/lib/modalities";
import { fillFor, shapeKind } from "@/lib/modalityTheme";
import type { PositionShape } from "@/lib/positionShapes";
import { cn } from "@/lib/utils";

// null for text glyphs
function OptionVisual({ mod, value }: { mod: game.ModID; value: game.Option }) {
	if (mod === game.MOD_COLOR) {
		return (
			<span
				className="size-3.5 shrink-0 rounded-full border border-border/60"
				style={{ background: fillFor(value) }}
			/>
		);
	}
	if (mod === game.MOD_SHAPE) {
		return (
			<svg viewBox="0 0 100 100" className="size-4 shrink-0" aria-hidden>
				<ShapeBody kind={shapeKind(value)} fill="currentColor" />
			</svg>
		);
	}
	if (mod === game.MOD_AUDIO) {
		return <Volume2 className="size-3.5 shrink-0" aria-hidden />;
	}
	return null;
}

export function OptionPicker({
	mod,
	options,
	selected,
	onToggle,
}: {
	mod: game.ModID;
	options: game.OptionList;
	selected: ReadonlySet<game.Option>;
	onToggle: (value: game.Option) => void;
}) {
	const atMin = selected.size <= game.MIN_OPTIONS_PER_MOD;
	return (
		<div className="flex flex-wrap gap-1.5">
			{options.map((value) => {
				const on = selected.has(value);
				const locked = on && atMin;
				return (
					<button
						key={value}
						type="button"
						aria-pressed={on}
						aria-disabled={locked}
						title={
							locked
								? `Keep at least ${game.MIN_OPTIONS_PER_MOD} selected`
								: undefined
						}
						onClick={() => {
							if (!locked) onToggle(value);
						}}
						className={cn(
							"inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
							on
								? "border-primary bg-primary/10 text-foreground"
								: "border-border bg-card text-muted-foreground hover:bg-accent",
							locked && "cursor-not-allowed",
						)}
					>
						<OptionVisual mod={mod} value={value} />
						<span className={cn(mod === game.MOD_CHARACTER && "font-mono")}>
							{optionLabel(mod, value)}
						</span>
						{locked && (
							<span className="sr-only">
								Keep at least {game.MIN_OPTIONS_PER_MOD} selected
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}

function ShapePreview({ options }: { options: game.OptionList }) {
	const { rows, cols } = game.positionGridDims(options);
	const active = new Set(options);
	return (
		<div
			className="grid size-9 gap-0.5"
			style={{
				gridTemplateColumns: `repeat(${cols}, 1fr)`,
				gridTemplateRows: `repeat(${rows}, 1fr)`,
			}}
			aria-hidden
		>
			{Array.from({ length: rows * cols }, (_, i) => {
				const row = Math.floor(i / cols);
				const col = i % cols;
				const on = active.has(game.positionCell(row, col));
				return (
					<span
						key={i}
						className={cn(
							"rounded-[2px]",
							on ? "bg-primary" : "bg-muted-foreground/15",
						)}
					/>
				);
			})}
		</div>
	);
}

export function ShapePicker({
	shapes,
	selectedId,
	onSelect,
}: {
	shapes: readonly PositionShape[];
	selectedId: string;
	onSelect: (id: string) => void;
}) {
	return (
		<div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
			{shapes.map((shape) => {
				const on = shape.id === selectedId;
				return (
					<button
						key={shape.id}
						type="button"
						aria-pressed={on}
						onClick={() => onSelect(shape.id)}
						className={cn(
							"flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors",
							on
								? "border-primary bg-primary/10"
								: "border-border bg-card hover:bg-accent",
						)}
					>
						<ShapePreview options={shape.options} />
						<span className="text-xs font-medium">{shape.label}</span>
					</button>
				);
			})}
		</div>
	);
}
