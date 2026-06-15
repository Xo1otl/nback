/**
 * A cosmetic remaining-time cue under the Stage: a bar that drains over the
 * responding window, restarted (via React `key`) on each responding onset. It
 * is decorative only — the driver owns the authoritative clock; if the two ever
 * disagree, the driver wins.
 */

export function TideBar({
	trial,
	active,
	durationMs,
}: {
	trial: number;
	active: boolean;
	durationMs: number;
}) {
	return (
		<div className="h-1 w-full overflow-hidden rounded-full bg-secondary/50">
			{active && (
				<div
					key={trial}
					className="tide-bar h-full w-full rounded-full bg-primary/40"
					style={{ animationDuration: `${durationMs}ms` }}
				/>
			)}
		</div>
	);
}
