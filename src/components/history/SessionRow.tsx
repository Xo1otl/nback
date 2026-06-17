import { ChevronRight } from "lucide-react";

import type * as game from "@/game";
import type { ScoredSession } from "@/components/history/types";
import { modMeta, sortedModIds } from "@/lib/modalities";
import { fmtDPrime } from "@/lib/score";

/** One session in the flat list: N badge + modality fingerprint + date + d′. */
export function SessionRow({
	scored,
	onSelect,
}: {
	scored: ScoredSession;
	onSelect: (record: game.SessionRecord) => void;
}) {
	const spec = scored.record.spec;
	const mods = sortedModIds(spec);
	const when = new Date(scored.record.createdAt).toLocaleString();
	return (
		<button
			type="button"
			onClick={() => onSelect(scored.record)}
			aria-label={`Session ${when}, ${spec.n}-back, sensitivity ${fmtDPrime(
				scored.dp,
			)}`}
			className="flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
		>
			<div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold tabular-nums text-primary">
				{spec.n}
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-1" aria-hidden>
					{mods.map((id) => {
						const Icon = modMeta(id).Icon;
						return <Icon key={id} className="size-3.5 text-muted-foreground" />;
					})}
				</div>
				<div className="truncate text-xs text-muted-foreground">{when}</div>
			</div>
			<div className="shrink-0 text-sm font-semibold tabular-nums">
				{fmtDPrime(scored.dp)}
			</div>
			<ChevronRight
				className="size-4 shrink-0 text-muted-foreground"
				aria-hidden
			/>
		</button>
	);
}
