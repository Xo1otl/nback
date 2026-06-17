import type { ScoredSession } from "@/components/history/types";
import { useElementWidth } from "@/hooks/useElementWidth";
import { fmtDPrime } from "@/lib/score";

const TREND_HEIGHT = 96;

/** A finite point on the trend: its index (so a blank session leaves a gap),
 * mean d′, and timestamp (for the tooltip). */
type TrendPoint = { readonly i: number; readonly dp: number; readonly createdAt: number };

/** Inner SVG of the d′ trend. Assumes measured width and ≥2 finite points. */
function TrendChart({
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

/** d′ trend for filtered sessions; plots once measured width + ≥2 finite points. */
export function DPrimeTrend({ points }: { points: readonly ScoredSession[] }) {
	const [ref, width] = useElementWidth<HTMLDivElement>();
	const series: TrendPoint[] = points.flatMap((p, i) =>
		p.dp != null && Number.isFinite(p.dp)
			? [{ i, dp: p.dp, createdAt: p.record.createdAt }]
			: [],
	);
	return (
		<div ref={ref} className="w-full" style={{ height: TREND_HEIGHT }}>
			{width > 0 && series.length >= 2 && (
				<TrendChart width={width} total={points.length} series={series} />
			)}
		</div>
	);
}
