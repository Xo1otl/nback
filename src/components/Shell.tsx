import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Full-viewport app frame. Screens render inside it and control their own
 * inner layout; `Shell` only guarantees a min-height, horizontal padding, and
 * a column flow so content can center or stretch as each screen needs.
 */
export function Shell({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				// `relative` so screens can anchor corner controls (e.g. ThemeToggle).
				"relative flex min-h-screen w-full flex-col items-center px-4 py-6 sm:py-10",
				className,
			)}
		>
			{children}
		</div>
	);
}
