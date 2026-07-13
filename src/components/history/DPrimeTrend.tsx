import type { ScoredSession } from "@/components/history/types";
import { useElementWidth } from "@/hooks/useElementWidth";
import { fmtDPrime } from "@/lib/score";

const TREND_HEIGHT = 96;

// i = index into full points list → blank sessions leave a gap
export type TrendPoint = { readonly i: number; readonly dp: number; readonly createdAt: number };

export type FiniteTrend = { readonly total: number; readonly series: readonly TrendPoint[] };

// SSOT for the finite-d′ series: headline, delta, and plotted dots read this one derivation.
export function finiteTrend(points: readonly ScoredSession[]): FiniteTrend {
	const series = points.flatMap((p, i) =>
		p.dp != null && Number.isFinite(p.dp)
			? [{ i, dp: p.dp, createdAt: p.record.createdAt }]
			: [],
	);
	return { total: points.length, series };
}

// assumes measured width and ≥2 finite points
function TrendSvg({
	width,
	total,
	series,
}: {
	width: number;
	total: number;
	series: readonly TrendPoint[];
}) {
	const padL = 24;
	const padR = 6;
	const padY = 10;
	const plotW = Math.max(1, width - padL - padR);
	const plotH = TREND_HEIGHT - padY * 2;

	const dps = series.map((s) => s.dp);
	const lo = Math.min(0, Math.floor(Math.min(...dps)));
	const hi = Math.max(lo + 1, Math.ceil(Math.max(...dps)));
	const span = hi - lo;

	const xOf = (idx: number) =>
		padL + (total <= 1 ? plotW / 2 : (idx / (total - 1)) * plotW);
	const yOf = (dp: number) => padY + (1 - (dp - lo) / span) * plotH;

	const ticks: number[] = [];
	for (let t = lo; t <= hi; t++) ticks.push(t);

	const line = series.map((s) => `${xOf(s.i)},${yOf(s.dp)}`).join(" ");
	const first = series[0]!;
	const last = series[series.length - 1]!;

	return (
		<svg
			width={width}
			height={TREND_HEIGHT}
			viewBox={`0 0 ${width} ${TREND_HEIGHT}`}
			role="img"
			aria-label={`Sensitivity trend over ${series.length} matching sessions, from d-prime ${fmtDPrime(
				first.dp,
			)} to ${fmtDPrime(last.dp)} latest`}
		>
			{ticks.map((t) => (
				<g key={t}>
					<line
						x1={padL}
						y1={yOf(t)}
						x2={width - padR}
						y2={yOf(t)}
						stroke="var(--color-border)"
						strokeWidth={1}
					/>
					<text
						x={padL - 6}
						y={yOf(t)}
						textAnchor="end"
						dominantBaseline="central"
						fontSize={10}
						fill="var(--color-muted-foreground)"
					>
						{t}
					</text>
				</g>
			))}
			<polyline
				points={line}
				fill="none"
				stroke="var(--color-primary)"
				strokeWidth={2}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			{series.map((s, k) => {
				const latest = k === series.length - 1;
				return (
					<circle
						key={s.i}
						cx={xOf(s.i)}
						cy={yOf(s.dp)}
						r={latest ? 4 : 2.5}
						fill={latest ? "var(--color-primary)" : "var(--color-card)"}
						stroke="var(--color-primary)"
						strokeWidth={1.5}
					>
						<title>{`${new Date(s.createdAt).toLocaleString()} · d′ ${fmtDPrime(
							s.dp,
						)}`}</title>
					</circle>
				);
			})}
		</svg>
	);
}

export function DPrimeTrend({ total, series }: FiniteTrend) {
	const [ref, width] = useElementWidth<HTMLDivElement>();
	return (
		<div ref={ref} className="w-full" style={{ height: TREND_HEIGHT }}>
			{width > 0 && series.length >= 2 && (
				<TrendSvg width={width} total={total} series={series} />
			)}
		</div>
	);
}
