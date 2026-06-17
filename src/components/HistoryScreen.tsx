import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import type * as game from "@/game";
import * as analysis from "@/analysis";
import * as storage from "@/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shell } from "@/components/Shell";
import { ScreenHeader } from "@/components/ScreenHeader";
import { DeltaChip } from "@/components/history/DeltaChip";
import { DPrimeTrend } from "@/components/history/TrendChart";
import { SearchBar } from "@/components/history/SearchBar";
import { SessionRow } from "@/components/history/SessionRow";
import type { ScoredSession } from "@/components/history/types";
import { fmtDPrime, meanDPrime } from "@/lib/score";

const NO_MATCH = "No sessions match this search.";

/** Screen 5 — token search over saved sessions; renders a d′ trend + flat list. */
export function HistoryScreen({
	onBack,
	onSelect,
	query,
	onQueryChange,
}: {
	onBack: () => void;
	onSelect: (record: game.SessionRecord) => void;
	/** Lifted to `App` and persisted, so it survives leaving/reopening + reload. */
	query: string;
	onQueryChange: (query: string) => void;
}) {
	const [reload, setReload] = useState(0);
	const all = useMemo<ScoredSession[]>(() => {
		void reload;
		return storage.loadSessions().map((record) => ({
			record,
			dp: meanDPrime(analysis.projectSessionScore(record)),
		}));
	}, [reload]);

	const tokens = useMemo(() => analysis.parseQuery(query), [query]);
	// Oldest-first (chronological) for the trend; newest-first for the list.
	const matching = all.filter((p) =>
		analysis.matchesQuery(p.record.spec, tokens),
	);
	const finite = matching
		.map((p) => p.dp)
		.filter((d): d is number => d != null && Number.isFinite(d));
	// latest = most recent FINITE d′; headline/delta/trend-dot must share it
	const latestDp = finite.length ? finite[finite.length - 1]! : null;
	const deltaDp =
		finite.length >= 2
			? finite[finite.length - 1]! - finite[finite.length - 2]!
			: null;

	return (
		<Shell>
			<div className="flex w-full max-w-lg flex-col gap-4">
				<ScreenHeader
					title="History"
					onBack={onBack}
					action={
						all.length > 0 ? (
							<Button
								variant="ghost"
								size="sm"
								className="ml-auto text-muted-foreground"
								onClick={() => {
									storage.clearSessions();
									onQueryChange("");
									setReload((x) => x + 1);
								}}
							>
								<Trash2 /> Clear
							</Button>
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
									<DPrimeTrend points={matching} />
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
