import { useState } from "react";
import { Plus, X } from "lucide-react";

import * as hf from "@/lib/historyFilter";
import {
	CONDITION_KINDS,
	conditionKindLabel,
	conditionLabel,
} from "@/lib/conditionDisplay";
import { Button } from "@/components/ui/button";
import { modMeta } from "@/lib/modalities";

/** A condition's content: modality icons for `mods`, text otherwise. */
function ConditionContent({ condition }: { condition: hf.Condition }) {
	if (condition.kind === "mods") {
		return (
			<span
				className="inline-flex items-center gap-0.5"
				aria-label={conditionLabel(condition)}
			>
				{condition.mods.map((id) => {
					const Icon = modMeta(id).Icon;
					return <Icon key={id} className="size-3.5" aria-hidden />;
				})}
			</span>
		);
	}
	return <span>{conditionLabel(condition)}</span>;
}

/** An active filter constraint with a remove affordance. */
function ConditionChip({
	condition,
	onRemove,
}: {
	condition: hf.Condition;
	onRemove: () => void;
}) {
	return (
		<span className="inline-flex items-center gap-1 rounded-full border bg-secondary/60 py-0.5 pe-0.5 ps-2 text-xs">
			<ConditionContent condition={condition} />
			<button
				type="button"
				aria-label={`Remove filter: ${conditionLabel(condition)}`}
				onClick={onRemove}
				className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted-foreground/20 hover:text-foreground"
			>
				<X className="size-3" aria-hidden />
			</button>
		</span>
	);
}

/** The "add filter" menu: addable conditions grouped by dimension. Inline (no
 * modal/popover) so it never overlays the graph + list it controls. */
function AddPanel({
	addable,
	onPick,
}: {
	addable: readonly hf.Condition[];
	onPick: (c: hf.Condition) => void;
}) {
	if (addable.length === 0) {
		return (
			<p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
				No more conditions to add — every distinct setting in your history is
				already filtered.
			</p>
		);
	}
	return (
		<div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
			{CONDITION_KINDS.map((kind) => {
				const group = addable.filter((c) => c.kind === kind);
				if (group.length === 0) return null;
				return (
					<div key={kind} className="flex flex-col gap-1">
						<span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
							{conditionKindLabel(kind)}
						</span>
						<div className="flex flex-wrap gap-1">
							{group.map((c) => (
								<button
									key={hf.conditionId(c)}
									type="button"
									onClick={() => onPick(c)}
									aria-label={`Add filter: ${conditionLabel(c)}`}
									className="rounded-md border bg-background px-2 py-1 text-xs transition-colors hover:bg-accent"
								>
									<ConditionContent condition={c} />
								</button>
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
}

/** The faceted filter: active constraints as removable chips + an inline "add"
 * menu drawing only conditions present in the history. */
export function FilterBar({
	filter,
	available,
	onChange,
}: {
	filter: hf.SessionFilter;
	/** Every condition present across the history (active ones are filtered out). */
	available: readonly hf.Condition[];
	onChange: (next: hf.SessionFilter) => void;
}) {
	const [adding, setAdding] = useState(false);
	const active = hf.activeConditions(filter);
	const activeIds = new Set(active.map(hf.conditionId));
	const addable = available.filter((c) => !activeIds.has(hf.conditionId(c)));

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-1.5">
				{active.map((c) => (
					<ConditionChip
						key={hf.conditionId(c)}
						condition={c}
						onRemove={() => onChange(hf.withoutCondition(filter, c))}
					/>
				))}
				{active.length === 0 && (
					<span className="text-xs text-muted-foreground">All sessions</span>
				)}
				<Button
					variant="outline"
					size="sm"
					aria-expanded={adding}
					className="h-7 gap-1 px-2 text-xs"
					onClick={() => setAdding((o) => !o)}
				>
					<Plus className="size-3.5" /> Add filter
				</Button>
				{active.length > 0 && (
					<Button
						variant="ghost"
						size="sm"
						className="h-7 px-2 text-xs text-muted-foreground"
						onClick={() => onChange({})}
					>
						Reset
					</Button>
				)}
			</div>
			{adding && (
				<AddPanel
					addable={addable}
					onPick={(c) => {
						onChange(hf.withCondition(filter, c));
						setAdding(false);
					}}
				/>
			)}
		</div>
	);
}
