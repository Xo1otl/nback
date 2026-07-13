import { Play } from "lucide-react";

import type * as game from "@/game";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { modMeta } from "@/lib/modalities";
import { KEY_FOR_MOD } from "@/lib/modKeys";

export function ReadyOverlay({
	mods,
	n,
	audioEnabled,
	onStart,
	onCancel,
}: {
	mods: readonly game.ModID[];
	n: number;
	audioEnabled: boolean;
	onStart: () => void;
	onCancel: () => void;
}) {
	return (
		<div className="absolute inset-0 z-10 flex items-center justify-center p-4">
			<Card className="w-full max-w-sm border-border/80 bg-card/95 text-center shadow-lg backdrop-blur">
				<CardHeader>
					<CardTitle>
						{n}-back · {mods.length}{" "}
						{mods.length === 1 ? "modality" : "modalities"}
					</CardTitle>
					<CardDescription>
						Press a modality when its value repeats from {n} trials ago.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="flex flex-wrap justify-center gap-2">
						{mods.map((mod) => {
							const meta = modMeta(mod);
							return (
								<span
									key={mod}
									className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs"
								>
									<meta.Icon className="size-3.5" />
									{meta.label}
									<kbd className="rounded border bg-background px-1 font-mono text-[10px]">
										{(KEY_FOR_MOD[mod] ?? "?").toUpperCase()}
									</kbd>
								</span>
							);
						})}
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="lg"
							className="flex-1"
							onClick={onCancel}
						>
							Cancel
						</Button>
						<Button size="lg" className="flex-1" onClick={onStart}>
							<Play /> Start
						</Button>
					</div>
					<p className="text-xs text-muted-foreground">
						Space or Enter to begin · Esc to cancel
						{audioEnabled ? " · sound on, listen for the letter" : ""}
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
