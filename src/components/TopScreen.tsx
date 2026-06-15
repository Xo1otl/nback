import { Brain, History, Play, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Shell } from "@/components/Shell";

/** Screen 1 — entry / menu. */
export function TopScreen({
	onPlay,
	onCustomize,
	onHistory,
}: {
	onPlay: () => void;
	onCustomize: () => void;
	onHistory: () => void;
}) {
	return (
		<Shell className="justify-center">
			<div className="flex w-full max-w-md flex-col items-center gap-8">
				<div className="flex flex-col items-center gap-3 text-center">
					<div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
						<Brain className="size-9" />
					</div>
					<h1 className="text-4xl font-bold tracking-tight">n-back</h1>
					<p className="max-w-sm text-balance text-muted-foreground">
						Multiplex working-memory training. Each trial, decide for every
						active modality whether it matches what you saw{" "}
						<span className="font-medium text-foreground">N steps ago</span>.
					</p>
				</div>

				<Card className="w-full">
					<CardHeader>
						<CardTitle>Train now</CardTitle>
						<CardDescription>
							Jump straight in with your last settings, or tweak them first.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						<Button size="lg" className="w-full" onClick={onPlay}>
							<Play /> Play
						</Button>
						<Button
							size="lg"
							variant="outline"
							className="w-full"
							onClick={onCustomize}
						>
							<SlidersHorizontal /> Customize
						</Button>
						<Button
							size="lg"
							variant="ghost"
							className="w-full"
							onClick={onHistory}
						>
							<History /> History &amp; progress
						</Button>
					</CardContent>
				</Card>
			</div>
		</Shell>
	);
}
