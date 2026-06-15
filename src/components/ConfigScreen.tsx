import { useState } from "react";
import { ArrowLeft, Check, Dices, Minus, Play, Plus } from "lucide-react";

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
import { ALL_MODS, modMeta } from "@/lib/modalities";
import { randomSeed } from "@/lib/ids";
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

/** Screen 2 — build a `SessionConfig` (N, mods, timing, seed). */
export function ConfigScreen({
	initial,
	onBack,
	onStart,
}: {
	/** Pre-fills the form (the current/last-used config). */
	initial: game.SessionConfig;
	onBack: () => void;
	onStart: (config: game.SessionConfig, seed: game.RandomSeed) => void;
}) {
	const [n, setN] = useState(initial.n);
	const [problemCount, setProblemCount] = useState(initial.problemCount);
	const [matchPct, setMatchPct] = useState(
		Math.round(initial.matchProbability * 100),
	);
	const [respondingMs, setRespondingMs] = useState(
		initial.timing.respondingDuration,
	);
	const [feedbackMs, setFeedbackMs] = useState(initial.timing.feedbackDuration);
	const [selected, setSelected] = useState<Set<game.ModID>>(
		() => new Set(initial.mods.map((m) => m.mod)),
	);
	const [seedText, setSeedText] = useState("");
	const [error, setError] = useState<string | null>(null);

	function toggleMod(id: game.ModID) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function handleStart() {
		const timing: game.TimingConfig = {
			respondingDuration: respondingMs,
			feedbackDuration: feedbackMs,
		};
		const base = game.defaultMultiplexConfig(
			n,
			problemCount,
			matchPct / 100,
			timing,
		);
		const config: game.SessionConfig = {
			...base,
			mods: base.mods.filter((m) => selected.has(m.mod)),
		};
		try {
			game.validateAndResolveConfig(config);
		} catch (err) {
			setError(
				err instanceof game.ConfigError ? err.message : String(err),
			);
			return;
		}
		onStart(config, seedText.trim() || randomSeed());
	}

	const totalTrials = n + problemCount;
	const canStart = selected.size > 0;

	return (
		<Shell>
			<div className="flex w-full max-w-lg flex-col gap-5">
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						aria-label="Back"
						onClick={onBack}
					>
						<ArrowLeft />
					</Button>
					<h1 className="text-2xl font-semibold tracking-tight">New session</h1>
				</div>

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
								return (
									<button
										key={id}
										type="button"
										aria-pressed={on}
										onClick={() => toggleMod(id)}
										className={cn(
											"relative flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
											on
												? "border-primary bg-primary/10"
												: "border-border bg-card hover:bg-accent",
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
						<CardTitle>Seed</CardTitle>
						<CardDescription>
							Same seed + settings reproduce the same stimuli. Leave blank for
							random.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2">
							<Input
								placeholder="(random)"
								value={seedText}
								onChange={(e) => setSeedText(e.target.value)}
							/>
							<Button
								type="button"
								variant="outline"
								size="icon"
								aria-label="Randomize seed"
								onClick={() => setSeedText(randomSeed())}
							>
								<Dices />
							</Button>
						</div>
					</CardContent>
				</Card>

				{error && (
					<p className="text-sm text-destructive" role="alert">
						{error}
					</p>
				)}

				<Button
					size="lg"
					className="w-full"
					disabled={!canStart}
					onClick={handleStart}
				>
					<Play /> Start session
				</Button>
				{!canStart && (
					<p className="text-center text-sm text-muted-foreground">
						Select at least one modality.
					</p>
				)}
			</div>
		</Shell>
	);
}
