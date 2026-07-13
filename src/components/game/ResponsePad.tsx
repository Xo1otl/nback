/** INVARIANT: pressed = pure projection of snapshot.responses (no local optimistic); ignored press never shows engaged. Feedback → outcome skin. */

import type * as game from "@/game";
import { modMeta } from "@/lib/modalities";
import { outcomeSkin } from "@/lib/modalityTheme";
import { cn } from "@/lib/utils";

export function ResponsePad({
	mod,
	keyHint,
	engaged,
	locked,
	outcome,
	onToggle,
	className,
}: {
	mod: game.ModID;
	keyHint: string;
	engaged: boolean;
	locked: boolean;
	outcome: game.Outcome | undefined;
	onToggle: () => void;
	className?: string;
}) {
	const meta = modMeta(mod);
	const skin = outcome !== undefined ? outcomeSkin(outcome) : null;
	const Icon = skin ? skin.Icon : meta.Icon;

	return (
		<button
			type="button"
			aria-pressed={engaged}
			// aria not native disabled: stay in tab order/AT tree while locked; clicks already no-op via driver guard.
			aria-disabled={locked || undefined}
			aria-label={
				skin
					? `${meta.label} modality — ${skin.word}`
					: `${meta.label} modality — ${engaged ? "engaged" : "not engaged"}, key ${keyHint.toUpperCase()}`
			}
			onClick={onToggle}
			className={cn(
				"relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-colors",
				skin
					? skin.className
					: engaged
						? "border-transparent bg-primary text-primary-foreground"
						: "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
				locked && "pointer-events-none",
				locked && !skin && "opacity-40",
				className,
			)}
		>
			<span className="absolute left-1.5 top-1.5 hidden rounded border border-border/60 bg-muted px-1 font-mono text-[10px] leading-tight text-muted-foreground sm:block">
				{keyHint.toUpperCase()}
			</span>
			<Icon className="size-5" />
			<span className="text-xs font-medium leading-none">
				{skin ? skin.word : meta.label}
			</span>
		</button>
	);
}
