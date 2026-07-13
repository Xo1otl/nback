import * as analysis from "@/analysis";

export function meanDPrime(score: analysis.SessionScore): number | null {
	// only mods with sdt present (absent ⇒ no observations); empty ⇒ null
	const dps = score.mods.flatMap((m) => (m.sdt ? [m.sdt.dPrime] : []));
	return dps.length === 0 ? null : dps.reduce((a, b) => a + b, 0) / dps.length;
}

export function overallAccuracy(score: analysis.SessionScore): number | null {
	let correct = 0;
	let total = 0;
	for (const m of score.mods) {
		correct += m.counts.h + m.counts.c;
		total += analysis.countsTotal(m.counts);
	}
	return total === 0 ? null : correct / total;
}

export function fmtDPrime(d: number | null | undefined): string {
	return d != null && Number.isFinite(d) ? d.toFixed(2) : "—";
}

export type BandKind = "guessing" | "developing" | "solid" | "sharp" | "elite";

export type SensitivityBand = {
	readonly kind: BandKind;
	readonly label: string;
	readonly tone: string;
};

export function sensitivityBand(
	d: number | null | undefined,
): SensitivityBand | null {
	if (d == null || !Number.isFinite(d)) return null;
	if (d < 0.5)
		return { kind: "guessing", label: "Guessing", tone: "text-muted-foreground" };
	if (d < 1.5)
		return {
			kind: "developing",
			label: "Developing",
			tone: "text-amber-700 dark:text-amber-300",
		};
	if (d < 2.5)
		return { kind: "solid", label: "Solid", tone: "text-teal-700 dark:text-teal-300" };
	if (d < 3.5)
		return {
			kind: "sharp",
			label: "Sharp",
			tone: "text-emerald-700 dark:text-emerald-300",
		};
	return { kind: "elite", label: "Elite", tone: "text-emerald-700 dark:text-emerald-300" };
}

export function isTopBand(band: SensitivityBand | null): boolean {
	return band?.kind === "elite";
}
