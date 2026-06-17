import { useEffect, useRef, useState } from "react";

/**
 * Track an element's content-box width in CSS pixels via `ResizeObserver`.
 * Returns a ref to attach plus the width (0 until first measured).
 * HAZARD: width is 0 on the first, unmeasured frame — reserve height at the
 * call site to avoid layout shift.
 */
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
