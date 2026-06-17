/** Ghost Back button + title + optional trailing action slot. */

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ScreenHeader({
	title,
	onBack,
	action,
}: {
	title: string;
	onBack: () => void;
	/** Trailing content pinned to the end of the row (e.g. a Clear button). */
	action?: ReactNode;
}) {
	return (
		<div className="flex items-center gap-2">
			<Button variant="ghost" size="icon" aria-label="Back" onClick={onBack}>
				<ArrowLeft />
			</Button>
			<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
			{action}
		</div>
	);
}
