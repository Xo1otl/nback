/** Done / aborted closing overlay. Accuracy is deferred to the analysis screen
 * (the live snapshot doesn't retain per-trial feedback). */

import { BarChart3, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function EndCard({
	aborted,
	n,
	total,
	onSeeResults,
	onHome,
}: {
	aborted: boolean;
	n: number;
	total: number;
	onSeeResults: () => void;
	onHome: () => void;
}) {
	return (
		<div className="absolute inset-0 z-10 flex items-center justify-center p-4">
			<Card className="w-full max-w-sm border-border/80 bg-card/95 text-center shadow-lg backdrop-blur">
				<CardHeader>
					<CardTitle>
						{aborted ? "Session ended early" : "Session complete"}
					</CardTitle>
					<CardDescription>
						{total} trials · {n}-back
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<Button size="lg" onClick={onSeeResults}>
						<BarChart3 /> {aborted ? "See partial results" : "See results"}
					</Button>
					<Button variant="ghost" onClick={onHome}>
						<Home /> Home
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
