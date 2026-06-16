import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";

import * as game from "@/game";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shell } from "@/components/Shell";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
	MIN_OPTIONS,
	OptionPicker,
	ShapePicker,
} from "@/components/config/OptionPicker";
import { ALL_MODS, modMeta } from "@/lib/modalities";
import {
	DEFAULT_POSITION_SHAPE,
	matchPositionShape,
	POSITION_SHAPES,
} from "@/lib/positionShapes";
import { matchPctOf, matchProbabilityFromPct } from "@/lib/sessionConfig";
import { cn } from "@/lib/utils";

/** A labeled integer stepper with −/+ and a number input. */
function NumberField({
	label,
	value,
	min,
	max,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	onChange: (n: number) => void;
}) {
	const clamp = (n: number) => Math.min(max, Math.max(min, n));
	return (
		<div className="flex flex-col gap-1.5">
			<Label>{label}</Label>
			<div className="flex items-center gap-1.5">
				<Button
					type="button"
					variant="outline"
					size="icon"
					aria-label={`Decrease ${label}`}
					onClick={() => onChange(clamp(value - 1))}
				>
					<Minus />
				</Button>
				<Input
					type="number"
					className="w-16 text-center"
					min={min}
					max={max}
					value={value}
					onChange={(e) => {
						const n = Number.parseInt(e.target.value, 10);
						if (!Number.isNaN(n)) onChange(clamp(n));
					}}
				/>
				<Button
					type="button"
					variant="outline"
					size="icon"
					aria-label={`Increase ${label}`}
					onClick={() => onChange(clamp(value + 1))}
				>
					<Plus />
				</Button>
			</div>
		</div>
	);
}

/** A labeled range slider with a formatted value readout. */
function SliderField({
	label,
	value,
	min,
	max,
	step,
	format,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	format: (n: number) => string;
	onChange: (n: number) => void;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-center justify-between">
				<Label>{label}</Label>
				<span className="text-sm font-medium tabular-nums text-muted-foreground">
					{format(value)}
				</span>
			</div>
			<input
				type="range"
				className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
			/>
		</div>
	);
}

/** Initial per-mod option subset: the `initial` config's options, else the full
 * canonical set. Position is driven by a shape picker instead, so it's omitted. */
function initialModOptions(
	initial: game.SessionConfig,
): Record<game.ModID, ReadonlySet<game.Option>> {
	const out: Record<game.ModID, ReadonlySet<game.Option>> = {};
	for (const id of ALL_MODS) {
		if (id === game.MOD_POSITION) continue;
		const fromInitial = game.specMod(initial, id)?.options;
		const canonical = game.CANONICAL_OPTIONS[id] ?? [];
		out[id] = new Set(fromInitial?.length ? fromInitial : canonical);
	}
	return out;
}

function initialShapeId(initial: game.SessionConfig): string {
	const pos = game.specMod(initial, game.MOD_POSITION);
	return (
		(pos && matchPositionShape(pos.options))?.id ?? DEFAULT_POSITION_SHAPE.id
	);
}

/** Screen 2 — a settings editor for the next session (N, mods + their option
 * pools, timing). Not a launch point: Back commits the edited config upward
 * (the next Play uses it); there is no separate start action. */
export function ConfigScreen({
	initial,
	onBack,
}: {
	/** Pre-fills the form (the current/last-used config). */
	initial: game.SessionConfig;
	/** Commit the edited settings and leave the screen. */
	onBack: (config: game.SessionConfig) => void;
}) {
	const [n, setN] = useState(initial.n);
	const [problemCount, setProblemCount] = useState(initial.problemCount);
	const [matchPct, setMatchPct] = useState(matchPctOf(initial));
	const [respondingMs, setRespondingMs] = useState(
		initial.timing.respondingDuration,
	);
	const [feedbackMs, setFeedbackMs] = useState(initial.timing.feedbackDuration);
	const [selected, setSelected] = useState<Set<game.ModID>>(
		() => new Set(initial.mods.map((m) => m.mod)),
	);
	const [modOptions, setModOptions] = useState<
		Record<game.ModID, ReadonlySet<game.Option>>
	>(() => initialModOptions(initial));
	const [shapeId, setShapeId] = useState(() => initialShapeId(initial));

	function toggleMod(id: game.ModID) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				if (next.size <= 1) return prev; // keep >= 1 modality enabled
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}

	function toggleOption(mod: game.ModID, value: game.Option) {
		setModOptions((prev) => {
			const cur = new Set(prev[mod] ?? []);
			if (cur.has(value)) {
				if (cur.size <= MIN_OPTIONS) return prev; // keep |O_m| >= 2
				cur.delete(value);
			} else {
				cur.add(value);
			}
			return { ...prev, [mod]: cur };
		});
	}

	/** Build a mod's resolved options: position from the shape, others from the
	 * picked subset (in canonical order so generation is order-stable). */
	function optionsFor(id: game.ModID): game.OptionList {
		if (id === game.MOD_POSITION) {
			const shape =
				POSITION_SHAPES.find((s) => s.id === shapeId) ?? DEFAULT_POSITION_SHAPE;
			return shape.options;
		}
		const chosen = modOptions[id] ?? new Set<game.Option>();
		return (game.CANONICAL_OPTIONS[id] ?? []).filter((o) => chosen.has(o));
	}

	/** Project the form state into a `SessionConfig`. Always valid by
	 * construction: every field is clamped to a legal range, each modality keeps
	 * >= 2 options, and at least one modality stays enabled. */
	function buildConfig(): game.SessionConfig {
		return {
			n,
			problemCount,
			matchProbability: matchProbabilityFromPct(matchPct),
			timing: {
				respondingDuration: respondingMs,
				feedbackDuration: feedbackMs,
			},
			mods: enabledMods.map((id) => ({
				mod: id,
				options: optionsFor(id),
			})),
		};
	}

	const totalTrials = n + problemCount;
	const enabledMods = ALL_MODS.filter((id) => selected.has(id));

	return (
		<Shell>
			<div className="flex w-full max-w-lg flex-col gap-5">
				<ScreenHeader title="Settings" onBack={() => onBack(buildConfig())} />

				<Card>
					<CardHeader>
						<CardTitle>Difficulty</CardTitle>
						<CardDescription>
							{totalTrials} trials — first {n} to memorize, then {problemCount}{" "}
							scored.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-5">
						<div className="flex flex-wrap gap-6">
							<NumberField
								label="N (back)"
								value={n}
								min={1}
								max={9}
								onChange={setN}
							/>
							<NumberField
								label="Scored trials"
								value={problemCount}
								min={1}
								max={200}
								onChange={setProblemCount}
							/>
						</div>
						<SliderField
							label="Match rate"
							value={matchPct}
							min={5}
							max={95}
							step={5}
							format={(v) => `${v}%`}
							onChange={setMatchPct}
						/>
						<SliderField
							label="Time per trial"
							value={respondingMs}
							min={800}
							max={5000}
							step={100}
							format={(v) => `${(v / 1000).toFixed(1)}s`}
							onChange={setRespondingMs}
						/>
						<SliderField
							label="Feedback time"
							value={feedbackMs}
							min={0}
							max={2000}
							step={100}
							format={(v) => `${(v / 1000).toFixed(1)}s`}
							onChange={setFeedbackMs}
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Modalities</CardTitle>
						<CardDescription>
							Pick what to track at once ({selected.size} selected).
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
							{ALL_MODS.map((id) => {
								const meta = modMeta(id);
								const on = selected.has(id);
								// The last enabled modality can't be turned off (>= 1 required).
								const locked = on && selected.size <= 1;
								return (
									<button
										key={id}
										type="button"
										aria-pressed={on}
										aria-disabled={locked}
										title={locked ? "Keep at least one modality" : undefined}
										onClick={() => {
											if (!locked) toggleMod(id);
										}}
										className={cn(
											"relative flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
											on
												? "border-primary bg-primary/10"
												: "border-border bg-card hover:bg-accent",
											locked && "cursor-not-allowed",
										)}
									>
										{on && (
											<Check className="absolute right-2 top-2 size-4 text-primary" />
										)}
										<meta.Icon className="size-5 text-muted-foreground" />
										<span className="text-sm font-medium">{meta.label}</span>
										<span className="text-xs text-muted-foreground">
											{meta.description}
										</span>
									</button>
								);
							})}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Stimulus pool</CardTitle>
						<CardDescription>
							Choose what each modality can show — at least two per modality.
							With fewer options the values recur and blur together, so a
							smaller pool is harder.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-5">
						{enabledMods.map((id) => {
							const meta = modMeta(id);
							const isPosition = id === game.MOD_POSITION;
							return (
								<div key={id} className="flex flex-col gap-2">
									<div className="flex items-center gap-2">
										<meta.Icon className="size-4 text-muted-foreground" />
										<span className="text-sm font-medium">{meta.label}</span>
										{!isPosition && (
											<span className="ml-auto text-xs tabular-nums text-muted-foreground">
												{modOptions[id]?.size ?? 0} on
											</span>
										)}
									</div>
									{isPosition ? (
										<ShapePicker
											shapes={POSITION_SHAPES}
											selectedId={shapeId}
											onSelect={setShapeId}
										/>
									) : (
										<OptionPicker
											mod={id}
											options={game.CANONICAL_OPTIONS[id] ?? []}
											selected={modOptions[id] ?? new Set()}
											onToggle={(v) => toggleOption(id, v)}
										/>
									)}
								</div>
							);
						})}
					</CardContent>
				</Card>
			</div>
		</Shell>
	);
}
