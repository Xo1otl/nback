import { cn } from "@/lib/utils";

const DAY = 86_400_000;

export type PeriodKey = "all" | "7d" | "30d" | "90d";

const PERIODS: readonly { key: PeriodKey; label: string; days: number | null }[] = [
	{ key: "all", label: "All", days: null },
	{ key: "7d", label: "7d", days: 7 },
	{ key: "30d", label: "30d", days: 30 },
	{ key: "90d", label: "90d", days: 90 },
];

/** Whether `createdAt` (epoch ms) is within `period` ending at `now`. `now`
 * injected so this stays pure. */
export function withinPeriod(createdAt: number, period: PeriodKey, now: number): boolean {
	const days = PERIODS.find((p) => p.key === period)?.days;
	return days == null || createdAt >= now - days * DAY;
}

/** Time-range narrowing for the History view (UI viewport, not a domain query). */
export function PeriodFilter({
	value,
	onChange,
}: {
	value: PeriodKey;
	onChange: (period: PeriodKey) => void;
}) {
	return (
		<div className="flex items-center gap-1" role="group" aria-label="Time range">
			{PERIODS.map((p) => (
				<button
					key={p.key}
					type="button"
					aria-pressed={value === p.key}
					onClick={() => onChange(p.key)}
					className={cn(
						"rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors",
						value === p.key
							? "border-primary bg-primary/10 text-foreground"
							: "border-border bg-secondary/60 text-muted-foreground hover:text-foreground",
					)}
				>
					{p.label}
				</button>
			))}
		</div>
	);
}
