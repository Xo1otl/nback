import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Dependency-free Label (the canonical shadcn new-york Label wraps
 * `@radix-ui/react-label`, which isn't a dependency here). A plain `<label>`
 * carries the same semantics for our static forms — clicking still focuses the
 * associated control via `htmlFor`.
 */
function Label({ className, ...props }: React.ComponentProps<"label">) {
	return (
		<label
			data-slot="label"
			className={cn(
				"flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
