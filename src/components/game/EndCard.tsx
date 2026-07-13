import { useEffect, useId, useRef } from "react";
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
	played,
	notSaved,
	onViewResults,
	onHome,
}: {
	aborted: boolean;
	n: number;
	total: number;
	/** Actual trials closed so far; only shown when `aborted`. */
	played: number;
	notSaved: "quota" | "unavailable" | null;
	onViewResults: () => void;
	onHome: () => void;
}) {
	const titleId = useId();
	const primaryRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		primaryRef.current?.focus();
	}, []);
	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			className="absolute inset-0 z-10 flex items-center justify-center p-4"
		>
			<Card className="w-full max-w-sm border-border/80 bg-card/95 text-center shadow-lg backdrop-blur">
				<CardHeader>
					<CardTitle id={titleId}>
						{aborted ? "Session ended early" : "Session complete"}
					</CardTitle>
					<CardDescription>
						{aborted ? `${played} of ${total} trials` : `${total} trials`} ·{" "}
						{n}-back
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					{notSaved !== null && (
						<p role="alert" className="text-sm text-destructive">
							{notSaved === "quota"
								? "Not saved — storage is full."
								: "Not saved — storage is unavailable."}
						</p>
					)}
					<Button ref={primaryRef} size="lg" onClick={onViewResults}>
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
