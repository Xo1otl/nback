import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Trash2 } from "lucide-react";

import * as analysis from "@/analysis";
import * as game from "@/game";
import * as storage from "@/storage";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Shell } from "@/components/Shell";
import { fmtDPrime, meanDPrime } from "@/lib/score";

type Row = {
	stored: storage.StoredSession;
	dp: number | null;
};

/** A tiny inline sensitivity (d′) trend line over chronological sessions. */
function Sparkline({ values }: { values: number[] }) {
	const finite = values.filter((v) => Number.isFinite(v));
	if (finite.length < 2) return null;
	const w = 100;
	const h = 28;
	const lo = Math.min(...finite);
	const hi = Math.max(...finite);
	const span = hi - lo || 1;
	const pts = values
		.map((v, i) => {
			const x = (i / (values.length - 1)) * w;
			const y = h - ((v - lo) / span) * h;
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(" ");
	return (
		<svg
			viewBox={`0 0 ${w} ${h}`}
			preserveAspectRatio="none"
			className="h-8 w-full"
			aria-hidden
		>
			<polyline
				points={pts}
				fill="none"
				stroke="var(--color-primary)"
				strokeWidth={1.5}
				strokeLinejoin="round"
				strokeLinecap="round"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}

/** Screen 5 — past sessions + d′ trend. Minimal. */
export function HistoryScreen({
	onBack,
	onSelect,
}: {
	onBack: () => void;
	onSelect: (record: game.SessionRecord) => void;
}) {
	const [reload, setReload] = useState(0);
	const rows = useMemo<Row[]>(() => {
		void reload;
		return storage.loadSessions().map((stored) => ({
			stored,
			dp: meanDPrime(analysis.projectSessionScore(stored.record)),
		}));
	}, [reload]);

	const trend = rows.map((r) => r.dp ?? Number.NaN);

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
					<h1 className="text-2xl font-semibold tracking-tight">History</h1>
					{rows.length > 0 && (
						<Button
							variant="ghost"
							size="sm"
							className="ml-auto text-muted-foreground"
							onClick={() => {
								storage.clearSessions();
								setReload((x) => x + 1);
							}}
						>
							<Trash2 /> Clear
						</Button>
					)}
				</div>

				{rows.length === 0 ? (
					<Card>
						<CardContent className="py-10 text-center text-muted-foreground">
							No sessions yet. Play one and it will show up here.
						</CardContent>
					</Card>
				) : (
					<>
						<Card>
							<CardHeader>
								<CardTitle>Sensitivity trend</CardTitle>
								<CardDescription>
									Mean sensitivity (d′) across {rows.length} sessions.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Sparkline values={trend} />
							</CardContent>
						</Card>

						<div className="flex flex-col gap-2">
							{rows
								.map((r, i) => ({ r, i }))
								.reverse()
								.map(({ r, i }) => {
									const { record, savedAt } = r.stored;
									return (
										<button
											key={`${record.id}-${i}`}
											type="button"
											onClick={() => onSelect(record)}
											className="flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
										>
											<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 font-semibold tabular-nums text-primary">
												{record.spec.n}
											</div>
											<div className="min-w-0 flex-1">
												<div className="truncate text-sm font-medium">
													{record.spec.n}-back ·{" "}
													{record.spec.mods.length} mods
												</div>
												<div className="truncate text-xs text-muted-foreground">
													{new Date(savedAt).toLocaleString()}
												</div>
											</div>
											<div className="text-right">
												<div className="text-xs text-muted-foreground">
													Sensitivity
												</div>
												<div className="font-semibold tabular-nums">
													{fmtDPrime(r.dp)}
												</div>
											</div>
											<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
										</button>
									);
								})}
						</div>
					</>
				)}
			</div>
		</Shell>
	);
}
