/**
 * One per-modality engage/disengage toggle. Its pressed state is a pure
 * projection of `snapshot.responses` (never local optimistic state), so a press
 * the driver ignores (memorize trial, outside the window) never shows engaged.
 * During feedback it wears the outcome skin instead.
 */

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
}: {
	mod: game.ModID;
	keyHint: string;
	engaged: boolean;
	/** Outside the scored responding window — input won't count. */
	locked: boolean;
	/** Present only during feedback on a scored trial. */
	outcome: game.Outcome | undefined;
	onToggle: () => void;
}) {
	const meta = modMeta(mod);
	const skin = outcome !== undefined ? outcomeSkin(outcome) : null;
	const Icon = skin ? skin.Icon : meta.Icon;

	return (
		<button
			type="button"
			aria-pressed={engaged}
			// Keep the button in the tab order and AT tree while locked (no native
			// `disabled`): clicks are already no-ops via the driver guard. The
			// accessible name reflects the feedback outcome when one is shown.
			aria-disabled={locked || undefined}
			aria-label={
				skin
					? `${meta.label} channel — ${skin.word}`
					: `${meta.label} channel — ${engaged ? "engaged" : "not engaged"}, key ${keyHint.toUpperCase()}`
			}
			onClick={onToggle}
			className={cn(
				"relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-colors",
				skin
					? skin.className
					: engaged
						? "border-transparent bg-primary text-primary-foreground"
						: "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
				locked && "pointer-events-none",
				locked && !skin && "opacity-40",
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
