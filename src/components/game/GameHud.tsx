/**
 * Slim top HUD: N level, 1-indexed trial counter, a memorize→scored progress
 * track, the live scored/memorize indicator, and a quiet Quit affordance.
 * Never shows a running score (keeps attention on the next stimulus).
 */

import { X } from "lucide-react";

import type * as driver from "@/driver";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function GameHud({
	snapshot,
	n,
	total,
	showQuit,
	onQuit,
}: {
	snapshot: driver.SessionSnapshot;
	n: number;
	total: number;
	showQuit: boolean;
	onQuit: () => void;
}) {
	// Before Start the driver reports trial 0; don't render it as "1/total" with
	// a filled bar — only count progress once the session has actually begun.
	const started = snapshot.status !== "idle";
	const shown = started ? Math.min(snapshot.trial + 1, total) : 0;
	const memorizePct = total > 0 ? (n / total) * 100 : 0;
	const progressPct = total > 0 ? (shown / total) * 100 : 0;

	return (
		<div className="mx-auto flex w-full max-w-2xl items-center gap-3">
			<Badge variant="secondary" className="tabular-nums">
				N={n}
			</Badge>
			<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
				{shown}/{total}
			</span>

			<div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
				<div
					className="absolute inset-y-0 left-0 bg-muted-foreground/25"
					style={{ width: `${memorizePct}%` }}
				/>
				<div
					className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300"
					style={{ width: `${progressPct}%` }}
				/>
			</div>

			{snapshot.status === "running" &&
				(snapshot.scored ? (
					<Badge className="shrink-0">Scored</Badge>
				) : (
					<Badge variant="outline" className="shrink-0 tabular-nums">
						Memorize {Math.min(snapshot.trial + 1, n)}/{n}
					</Badge>
				))}

			{showQuit && (
				<Button
					variant="ghost"
					size="sm"
					className="shrink-0 text-muted-foreground"
					onClick={onQuit}
				>
					<X />
					<span className="hidden sm:inline">Quit</span>
				</Button>
			)}
		</div>
	);
}
