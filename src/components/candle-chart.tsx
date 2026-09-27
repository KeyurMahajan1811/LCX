"use client";

import type { Candle } from "@/lib/types";

function stamp(value: number) {
  return value < 1e12 ? value * 1000 : value;
}

export function CandleChart({ candles }: { candles: Candle[] }) {
  const rows = [...candles]
    .filter((candle) => candle.open > 0 || candle.close > 0)
    .sort((a, b) => stamp(a.timestamp) - stamp(b.timestamp))
    .slice(-120);

  if (rows.length === 0) {
    return (
      <p className="px-3 py-16 text-center text-sm text-muted-foreground">
        LCX has no candles for this window. The last traded price is still shown above.
      </p>
    );
  }

  const width = 720;
  const height = 280;
  const pad = { l: 8, r: 58, t: 12, b: 22 };
  const innerW = width - pad.l - pad.r;
  const priceH = 200;
  const highs = rows.map((row) => row.high || row.close);
  const lows = rows.map((row) => row.low || row.close);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const span = max - min || max * 0.01 || 1;
  const maxVol = Math.max(...rows.map((row) => row.volume), 1);
  const slot = innerW / rows.length;
  const y = (price: number) => pad.t + ((max - price) / span) * priceH;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const up = (last?.close ?? 0) >= (first?.open ?? 0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full" role="img" aria-label="Price candles">
      {[0, 0.5, 1].map((step) => {
        const price = min + span * (1 - step);
        const yy = y(price);
        return (
          <g key={step}>
            <line x1={pad.l} x2={width - pad.r} y1={yy} y2={yy} stroke="currentColor" opacity="0.08" />
            <text x={width - pad.r + 6} y={yy + 4} fill="currentColor" opacity="0.55" fontSize="11">
              {price >= 100 ? price.toFixed(0) : price >= 1 ? price.toFixed(2) : price.toPrecision(4)}
            </text>
          </g>
        );
      })}
      {rows.map((row, index) => {
        const x = pad.l + index * slot + slot / 2;
        const open = row.open || row.close;
        const close = row.close || row.open;
        const high = row.high || Math.max(open, close);
        const low = row.low || Math.min(open, close);
        const rising = close >= open;
        const color = rising ? "var(--up)" : "var(--down)";
        const bodyTop = y(Math.max(open, close));
        const bodyH = Math.max(1, Math.abs(y(open) - y(close)));
        const volH = (row.volume / maxVol) * 36;
        return (
          <g key={`${row.timestamp}-${index}`}>
            <line x1={x} x2={x} y1={y(high)} y2={y(low)} stroke={color} strokeWidth="1" />
            <rect x={x - Math.max(1, slot * 0.28)} y={bodyTop} width={Math.max(2, slot * 0.56)} height={bodyH} fill={color} />
            <rect
              x={x - Math.max(1, slot * 0.28)}
              y={height - pad.b - volH}
              width={Math.max(2, slot * 0.56)}
              height={volH}
              fill={color}
              opacity="0.35"
            />
          </g>
        );
      })}
      <text x={pad.l} y={height - 6} fill="currentColor" opacity="0.5" fontSize="11">
        {new Date(stamp(first?.timestamp ?? 0)).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
      </text>
      <text x={width - pad.r - 70} y={height - 6} fill="currentColor" opacity="0.5" fontSize="11">
        {new Date(stamp(last?.timestamp ?? 0)).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
      </text>
      <text x={width - 52} y={16} fill={up ? "var(--up)" : "var(--down)"} fontSize="11">
        {up ? "Up" : "Down"}
      </text>
    </svg>
  );
}
