import { ChevronRight, Trash2 } from "lucide-react";
import type { ScoredSession } from "@/components/history/types";
import { Button } from "@/components/ui/button";
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
import type * as game from "@/game";
import { modMeta, sortedModIds } from "@/lib/modalities";
import { fmtDPrime } from "@/lib/score";

/** HAZARD: open + delete are sibling buttons, not nested — a <button> can't nest in a <button>. */
export function SessionRow({
	scored,
	onSelect,
	onDelete,
}: {
	scored: ScoredSession;
	onSelect: (record: game.SessionRecord) => void;
	onDelete: (id: game.SessionID) => void;
}) {
	const spec = scored.record.spec;
	const mods = sortedModIds(spec);
	const when = new Date(scored.record.createdAt).toLocaleString();
	return (
		<div className="flex items-stretch overflow-hidden rounded-lg border bg-card">
			<button
				type="button"
				onClick={() => onSelect(scored.record)}
				aria-label={`Session ${when}, ${spec.n}-back, sensitivity ${fmtDPrime(
					scored.dp,
				)}`}
				className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left transition-colors hover:bg-accent"
			>
				<div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold tabular-nums text-primary">
					{spec.n}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-1" aria-hidden>
						{mods.map((id) => {
							const Icon = modMeta(id).Icon;
							return (
								<Icon key={id} className="size-3.5 text-muted-foreground" />
							);
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

			<Dialog>
				<DialogTrigger asChild>
					<Button
						variant="ghost"
						aria-label={`Delete session from ${when}`}
						className="h-auto rounded-none border-l px-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
					>
						<Trash2 className="size-4" />
					</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete this session?</DialogTitle>
						<DialogDescription>
							This permanently removes the {spec.n}-back session from {when}.
							This can&rsquo;t be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<DialogClose asChild>
							<Button
								variant="destructive"
								onClick={() => onDelete(scored.record.id)}
							>
								<Trash2 /> Delete
							</Button>
						</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
