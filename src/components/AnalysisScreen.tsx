import { useMemo } from "react";
import { Home, History, RotateCcw } from "lucide-react";

import * as analysis from "@/analysis";
import * as game from "@/game";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Shell } from "@/components/Shell";
import { modMeta } from "@/lib/modalities";
import {
	fmtDPrime,
	isTopBand,
	meanDPrime,
	overallAccuracy,
	sensitivityBand,
} from "@/lib/score";
import { cn } from "@/lib/utils";

/** Screen 4 — single-session score (per-mod SDT). */
export function AnalysisScreen({
	record,
	onPlayAgain,
	onHistory,
	onHome,
}: {
	record: game.SessionRecord;
	onPlayAgain: () => void;
	onHistory: () => void;
	onHome: () => void;
}) {
	const score = useMemo(() => analysis.projectSessionScore(record), [record]);
	const dp = meanDPrime(score);
	const band = sensitivityBand(dp);
	const acc = overallAccuracy(score);
	// A flawless run (100% accuracy) still caps below "Elite" on a short session:
	// the log-linear d′ ceiling rises with the number of *scored trials* (not N or
	// match rate). Rather than fake the top band, nudge toward a longer session.
	const cappedFlawless = acc === 1 && !isTopBand(band);

	return (
		<Shell>
			<div className="flex w-full max-w-2xl flex-col gap-5">
				<div className="flex flex-col gap-1 text-center">
					<h1 className="text-2xl font-semibold tracking-tight">
						Session complete
					</h1>
					<p className="text-sm text-muted-foreground">
						{record.spec.n}-back · {record.spec.problemCount} scored trials ·{" "}
						{record.spec.mods.length} modalities
					</p>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<Card>
						<CardHeader>
							<CardDescription>
								Sensitivity{" "}
								<span className="text-muted-foreground/70">(d′)</span>
							</CardDescription>
							<CardTitle className="text-3xl tabular-nums">
								{fmtDPrime(dp)}
							</CardTitle>
							{band && (
								<p className={cn("text-sm font-medium", band.tone)}>
									{band.label}
								</p>
							)}
							{cappedFlawless && (
								<p className="text-xs text-muted-foreground">
									Flawless — add scored trials to reach Elite
								</p>
							)}
						</CardHeader>
					</Card>
					<Card>
						<CardHeader>
							<CardDescription>Accuracy</CardDescription>
							<CardTitle className="text-3xl tabular-nums">
								{acc != null ? `${Math.round(acc * 100)}%` : "—"}
							</CardTitle>
							<p className="text-sm text-muted-foreground">
								Correct calls overall
							</p>
						</CardHeader>
					</Card>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Per modality</CardTitle>
						<CardDescription>
							Hits / Misses / False alarms / Correct rejects. Sensitivity (d′)
							is how sharply you told matches from non-matches; bias (c) leans
							negative if you over-respond, positive if you under-respond.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b text-left text-muted-foreground">
										<th className="py-2 pr-2 font-medium">Modality</th>
										<th
											className="px-2 py-2 text-center font-medium"
											title="Hits"
										>
											H
										</th>
										<th
											className="px-2 py-2 text-center font-medium"
											title="Misses"
										>
											M
										</th>
										<th
											className="px-2 py-2 text-center font-medium"
											title="False alarms"
										>
											F
										</th>
										<th
											className="px-2 py-2 text-center font-medium"
											title="Correct rejects"
										>
											C
										</th>
										<th
											className="px-2 py-2 text-right font-medium"
											title="Sensitivity (d′)"
										>
											Sens.
										</th>
										<th
											className="py-2 pl-2 text-right font-medium"
											title="Bias (c)"
										>
											Bias
										</th>
									</tr>
								</thead>
								<tbody>
									{score.mods.map((m) => {
										const meta = modMeta(m.counts.mod);
										return (
											<tr key={m.counts.mod} className="border-b last:border-0">
												<td className="py-2 pr-2">
													<span className="flex items-center gap-2">
														<meta.Icon className="size-4 text-muted-foreground" />
														{meta.label}
													</span>
												</td>
												<td className="px-2 py-2 text-center tabular-nums">
													{m.counts.h}
												</td>
												<td className="px-2 py-2 text-center tabular-nums text-muted-foreground">
													{m.counts.m}
												</td>
												<td className="px-2 py-2 text-center tabular-nums text-muted-foreground">
													{m.counts.f}
												</td>
												<td className="px-2 py-2 text-center tabular-nums">
													{m.counts.c}
												</td>
												<td className="px-2 py-2 text-right font-medium tabular-nums">
													{fmtDPrime(m.sdt.dPrime)}
												</td>
												<td className="py-2 pl-2 text-right tabular-nums text-muted-foreground">
													{Number.isFinite(m.sdt.criterion)
														? m.sdt.criterion.toFixed(2)
														: "—"}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>

				<div className="flex flex-wrap gap-3">
					<Button className="flex-1" onClick={onPlayAgain}>
						<RotateCcw /> Play again (same settings)
					</Button>
					<Button variant="outline" onClick={onHistory}>
						<History /> History
					</Button>
					<Button variant="ghost" onClick={onHome}>
						<Home /> Home
					</Button>
				</div>
			</div>
		</Shell>
	);
}
