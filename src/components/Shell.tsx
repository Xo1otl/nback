import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Full-viewport app frame; screens control their own inner layout. */
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
				"relative flex min-h-screen w-full flex-col items-center px-4 py-6 sm:py-10",
				className,
			)}
		>
			{children}
		</div>
	);
}
