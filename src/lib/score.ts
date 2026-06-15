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
