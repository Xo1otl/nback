import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

// HAZARD: direction must read from icon shape, not color alone
export function DeltaChip({ delta }: { delta: number }) {
	const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
	const tone =
		delta > 0
			? "text-emerald-700 dark:text-emerald-300"
			: delta < 0
				? "text-rose-700 dark:text-rose-300"
				: "text-muted-foreground";
	const label =
		delta === 0
			? "Sensitivity unchanged versus previous matching session"
			: `Sensitivity ${delta > 0 ? "up" : "down"} ${Math.abs(delta).toFixed(
					2,
				)} versus previous matching session`;
	return (
		<span
			className={cn("flex items-center gap-0.5 text-xs", tone)}
			aria-label={label}
		>
			<Icon className="size-3.5" aria-hidden />
			<span className="tabular-nums">
				{delta > 0 ? "+" : delta < 0 ? "−" : ""}
				{Math.abs(delta).toFixed(2)}
			</span>
		</span>
	);
}
