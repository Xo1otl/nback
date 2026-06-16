/** Small presentation-level aggregates over an `analysis.SessionScore`. */

import * as analysis from "@/analysis";

/** Mean d' across modalities (finite values only); `null` if none. */
export function meanDPrime(score: analysis.SessionScore): number | null {
	const vals = score.mods
		.map((m) => m.sdt.dPrime)
		.filter((d) => Number.isFinite(d));
	if (vals.length === 0) return null;
	return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Overall accuracy = (hits + correct rejects) / scored cells; `null` if empty. */
export function overallAccuracy(score: analysis.SessionScore): number | null {
	let correct = 0;
	let total = 0;
	for (const m of score.mods) {
		correct += m.counts.h + m.counts.c;
		total += analysis.countsTotal(m.counts);
	}
	return total === 0 ? null : correct / total;
}

/** d' formatted for display, or an em dash for non-finite/absent values. */
export function fmtDPrime(d: number | null | undefined): string {
	return d != null && Number.isFinite(d) ? d.toFixed(2) : "—";
}

export type SensitivityBand = {
	/** A one-word qualitative read of the d′ value. */
	readonly label: string;
	/** A Tailwind text-color class, matched to the outcome-skin palette. */
	readonly tone: string;
};

/**
 * Map a d′ value to a plain-language band so the number is interpretable
 * without knowing signal-detection theory. Roughly: 0 ≈ guessing, ~1 = a real
 * but shaky signal, 2–3 = strong, 4+ = near-ceiling. `null` for absent/∞.
 */
export function sensitivityBand(
	d: number | null | undefined,
): SensitivityBand | null {
	if (d == null || !Number.isFinite(d)) return null;
	// Paired light (`-700`) / dark (`dark:-300`) shades so the band reads on
	// both themes; "Guessing" stays on the theme-aware muted token.
	if (d < 0.5) return { label: "Guessing", tone: "text-muted-foreground" };
	if (d < 1.5)
		return { label: "Developing", tone: "text-amber-700 dark:text-amber-300" };
	if (d < 2.5)
		return { label: "Solid", tone: "text-teal-700 dark:text-teal-300" };
	if (d < 3.5)
		return { label: "Sharp", tone: "text-emerald-700 dark:text-emerald-300" };
	return { label: "Elite", tone: "text-emerald-700 dark:text-emerald-300" };
}

/** Whether a band is the top ("Elite") tier. Keeps the label string confined to
 * this module so callers test the tier, not a display word. */
export function isTopBand(band: SensitivityBand | null): boolean {
	return band?.label === "Elite";
}
