import { useEffect, useRef, useState } from "react";

/**
 * Track an element's content-box width in CSS pixels via `ResizeObserver`.
 * Returns a ref to attach plus the measured width (0 until first measured).
 *
 * Wraps an irreducible browser seam: there is no render-time way to know an
 * element's laid-out width, which an SVG chart needs to plot at real pixel
 * coordinates (so points/labels don't distort the way `preserveAspectRatio`
 * stretching would). Reserve the height at the call site to avoid layout shift
 * during the first, unmeasured frame.
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
