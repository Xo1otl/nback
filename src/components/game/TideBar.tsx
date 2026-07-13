/** Cosmetic remaining-time cue; decorative only — driver owns authoritative clock. Restart via React key per responding onset. */

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
