import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import type * as game from "@/game";
import * as analysis from "@/analysis";
import * as search from "@/search";
import * as storage from "@/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Shell } from "@/components/Shell";
import { ScreenHeader } from "@/components/ScreenHeader";
import { DeltaChip } from "@/components/history/DeltaChip";
import { DPrimeTrend, finiteTrend } from "@/components/history/DPrimeTrend";
import { SearchBar } from "@/components/history/SearchBar";
import { PeriodFilter, withinPeriod, type PeriodKey } from "@/components/history/PeriodFilter";
import { SessionRow } from "@/components/history/SessionRow";
import type { ScoredSession } from "@/components/history/types";
import { fmtDPrime, meanDPrime } from "@/lib/score";

const NO_MATCH = "No sessions match this search.";

export function HistoryScreen({
	onBack,
	onSelect,
	query,
	onQueryChange,
}: {
	onBack: () => void;
	onSelect: (record: game.SessionRecord) => void;
	// owned + persisted by App; survives reload
	query: string;
	onQueryChange: (query: string) => void;
}) {
	const [reload, setReload] = useState(0);
	const [period, setPeriod] = useState<PeriodKey>("all");
	const [now] = useState(() => Date.now());
	const all = useMemo<ScoredSession[]>(() => {
		void reload;
		return storage.loadSessions().map((record) => ({
			record,
			dp: meanDPrime(analysis.projectSessionScore(record)),
		}));
	}, [reload]);

	const tokens = useMemo(() => search.parseQuery(query), [query]);
	// trend reads matching as-is (chronological); list reverses for newest-first
	const matching = all.filter(
		(p) =>
			search.matchesQuery(p.record, tokens) &&
			withinPeriod(p.record.createdAt, period, now),
	);
	const filtered = matching.length < all.length;
	const clearCopy = filtered
		? {
				title: "Clear matching sessions?",
				body: `This permanently removes the ${matching.length} session${matching.length === 1 ? "" : "s"} matching the current search and time filter. This can’t be undone.`,
				confirm: `Clear ${matching.length}`,
			}
		: {
				title: "Clear all sessions?",
				body: `This permanently removes all ${all.length} saved sessions. This can’t be undone.`,
				confirm: "Clear all",
			};
	// headline/delta/trend-dot share this one finite-d′ series → agreement by construction
	const { total, series } = finiteTrend(matching);
	const latestDp = series.length ? series[series.length - 1]!.dp : null;
	const deltaDp =
		series.length >= 2
			? series[series.length - 1]!.dp - series[series.length - 2]!.dp
			: null;

	return (
		<Shell>
			<div className="flex w-full max-w-lg flex-col gap-4">
				<ScreenHeader
					title="History"
					onBack={onBack}
					action={
						matching.length > 0 ? (
							<Dialog>
								<DialogTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="ml-auto text-muted-foreground"
									>
										<Trash2 /> Clear
									</Button>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>{clearCopy.title}</DialogTitle>
										<DialogDescription>{clearCopy.body}</DialogDescription>
									</DialogHeader>
									<DialogFooter>
										<DialogClose asChild>
											<Button variant="outline">Cancel</Button>
										</DialogClose>
										<DialogClose asChild>
											<Button
												variant="destructive"
												onClick={() => {
													storage.deleteSessions(
														matching.map((p) => p.record.id),
													);
													// full clear resets query; filtered clear keeps it
													if (!filtered) onQueryChange("");
													setReload((x) => x + 1);
												}}
											>
												<Trash2 /> {clearCopy.confirm}
											</Button>
										</DialogClose>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						) : undefined
					}
				/>

				{all.length === 0 ? (
					<Card>
						<CardContent className="py-10 text-center text-muted-foreground">
							No sessions yet. Play one and it will show up here.
						</CardContent>
					</Card>
				) : (
					<>
						<SearchBar
							query={query}
							tokens={tokens}
							matchCount={matching.length}
							total={all.length}
							onChange={onQueryChange}
						/>
						<PeriodFilter value={period} onChange={setPeriod} />

						<Card>
							<CardContent className="flex flex-col gap-3 pt-6">
								<div className="flex items-start justify-between gap-2">
									<div className="text-sm font-medium">Sensitivity trend</div>
									<div className="text-right">
										<div className="text-lg font-semibold leading-none tabular-nums">
											{fmtDPrime(latestDp)}
										</div>
										{deltaDp != null && (
											<div className="mt-1 flex justify-end">
												<DeltaChip delta={deltaDp} />
											</div>
										)}
									</div>
								</div>
								{matching.length >= 2 ? (
									<DPrimeTrend total={total} series={series} />
								) : (
									<p className="text-xs text-muted-foreground">
										{matching.length === 1
											? "One matching session — play it again to start a trend."
											: NO_MATCH}
									</p>
								)}
							</CardContent>
						</Card>

						<div className="flex flex-col gap-2">
							{matching.length === 0 ? (
								<p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
									{NO_MATCH}
								</p>
							) : (
								[...matching]
									.reverse()
									.map((p) => (
										<SessionRow
											key={p.record.id}
											scored={p}
											onSelect={onSelect}
											onDelete={(id) => {
												storage.deleteSession(id);
												setReload((x) => x + 1);
											}}
										/>
									))
							)}
						</div>
					</>
				)}
			</div>
		</Shell>
	);
}
