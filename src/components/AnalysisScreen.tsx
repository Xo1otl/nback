import { useMemo } from "react";
import { Home, History, RotateCcw } from "lucide-react";

import * as analysis from "@/analysis";
import * as game from "@/game";
import { Badge } from "@/components/ui/badge";
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
import { fmtDPrime, meanDPrime, overallAccuracy } from "@/lib/score";

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
	const score = useMemo(
		() => analysis.projectSessionScore(record),
		[record],
	);
	const dp = meanDPrime(score);
	const acc = overallAccuracy(score);

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
							<CardDescription>Mean d′ (sensitivity)</CardDescription>
							<CardTitle className="text-3xl tabular-nums">
								{fmtDPrime(dp)}
							</CardTitle>
						</CardHeader>
					</Card>
					<Card>
						<CardHeader>
							<CardDescription>Accuracy</CardDescription>
							<CardTitle className="text-3xl tabular-nums">
								{acc != null ? `${Math.round(acc * 100)}%` : "—"}
							</CardTitle>
						</CardHeader>
					</Card>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Per modality</CardTitle>
						<CardDescription>
							Hits / Misses / False alarms / Correct rejects, with signal
							detection d′ and bias c.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b text-left text-muted-foreground">
										<th className="py-2 pr-2 font-medium">Modality</th>
										<th className="px-2 py-2 text-center font-medium" title="Hits">
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
										<th className="px-2 py-2 text-right font-medium">d′</th>
										<th className="py-2 pl-2 text-right font-medium">c</th>
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
						<RotateCcw /> Play again
					</Button>
					<Button variant="outline" onClick={onHistory}>
						<History /> History
					</Button>
					<Button variant="ghost" onClick={onHome}>
						<Home /> Home
					</Button>
				</div>

				<p className="text-center text-xs text-muted-foreground">
					Seed <Badge variant="secondary">{record.seed}</Badge>
				</p>
			</div>
		</Shell>
	);
}
