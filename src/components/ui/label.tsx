import * as React from "react";

import { cn } from "@/lib/utils";

/** Dependency-free: canonical shadcn Label wraps @radix-ui/react-label (not a dep here); plain <label> carries same htmlFor semantics. */
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
