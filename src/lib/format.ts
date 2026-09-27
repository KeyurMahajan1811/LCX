export function formatNumber(
  value: number | null | undefined,
  digits = 4,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const places =
    abs === 0 ? 2 : abs >= 1000 ? 2 : abs >= 1 ? Math.min(digits, 4) : digits;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: abs >= 1000 ? 2 : 0,
    maximumFractionDigits: places,
  });
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value === 0) return "—";
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 5 : 8;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatChange(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

export function formatTime(seconds: number): string {
  if (!seconds) return "—";
  const ms = seconds < 1e12 ? seconds * 1000 : seconds;
  return new Date(ms).toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function pairParts(symbol: string): { base: string; quote: string } {
  const [base, quote] = symbol.split("/");
  return { base: base ?? symbol, quote: quote ?? "" };
}

export function tradePath(symbol: string): string {
  const { base, quote } = pairParts(symbol);
  return `/trade/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`;
}

export function changeTone(value: number): "up" | "down" | "flat" {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}
