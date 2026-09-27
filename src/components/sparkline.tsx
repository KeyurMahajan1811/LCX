import type { ChartPoint } from "@/lib/types";

export function sparkPoints(points: ChartPoint[] | undefined): number[] {
  return (points ?? []).filter((point) => point.Time > 0 && point.Close > 0).map((point) => point.Close);
}

export function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) {
    return <span className="text-xs text-muted-foreground">No path</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 88;
  const height = 28;
  const d = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 2) - 1;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.5" />
    </svg>
  );
}
