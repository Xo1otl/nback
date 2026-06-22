import { useEffect, useRef, useState } from "react";

// content-box width via ResizeObserver; ref + width.
// HAZARD: width=0 on first unmeasured frame → reserve height at call site.
export function useElementWidth<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	const [width, setWidth] = useState(0);

	useEffect(() => {
		const el = ref.current;
		if (!el || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width;
			if (w != null) setWidth(w);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return [ref, width] as const;
}
