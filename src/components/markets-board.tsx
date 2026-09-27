"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Panel, StatusLine } from "@/components/shell";
import { Sparkline, sparkPoints } from "@/components/sparkline";
import { changeTone, formatChange, formatNumber, formatPrice, pairParts, tradePath } from "@/lib/format";
import type { Ticker } from "@/lib/types";
import { cn } from "cn";

const QUOTES = ["All", "EUR", "USDC", "BTC", "ETH", "LCX"];

type SortKey = "symbol" | "lastPrice" | "change" | "volume";

export function MarketsBoard() {
  const [tickers, setTickers] = useState<Record<string, Ticker> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [quote, setQuote] = useState("EUR");
  const [sort, setSort] = useState<SortKey>("volume");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [updated, setUpdated] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/market/tickers");
        const body = (await response.json()) as { data?: Record<string, Ticker>; error?: string };
        if (!response.ok) throw new Error(body.error || "Ticker request failed.");
        if (!cancelled) {
          setTickers(body.data ?? {});
          setError(null);
          setUpdated(Date.now());
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not reach LCX.");
      }
    }
    load();
    const timer = window.setInterval(load, 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const rows = useMemo(() => {
    const list = Object.values(tickers ?? {});
    const needle = query.trim().toLowerCase();
    const filtered = list.filter((ticker) => {
      const { quote: q } = pairParts(ticker.symbol);
      if (quote !== "All" && q !== quote) return false;
      if (!needle) return true;
      return (
        ticker.symbol.toLowerCase().includes(needle) ||
        (ticker.baseFullName ?? "").toLowerCase().includes(needle)
      );
    });
    filtered.sort((a, b) => {
      const left = sort === "symbol" ? a.symbol : a[sort] || 0;
      const right = sort === "symbol" ? b.symbol : b[sort] || 0;
      if (left < right) return direction === "asc" ? -1 : 1;
      if (left > right) return direction === "asc" ? 1 : -1;
      return a.symbol.localeCompare(b.symbol);
    });
    return filtered;
  }, [direction, query, quote, sort, tickers]);

  function toggleSort(key: SortKey) {
    if (sort === key) setDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDirection(key === "symbol" ? "asc" : "desc");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Live pairs from the LCX exchange. Open a market to read the book, candles, and public prints,
            then practice in the paper book kept in this browser.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {updated ? `Updated ${new Date(updated).toLocaleTimeString()}` : "Waiting for the first snapshot"}
          {tickers ? ` · ${Object.keys(tickers).length} pairs` : ""}
        </p>
      </div>

      <Panel
        title="Board"
        action={
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search LCX, Bitcoin…"
            className="w-44"
            aria-label="Search markets"
          />
        }
      >
        <div className="flex flex-wrap gap-1.5 px-3 py-2">
          {QUOTES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setQuote(item)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs",
                quote === item ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <StatusLine
          loading={!tickers && !error}
          error={error}
          empty={tickers && rows.length === 0 ? "No pairs match that filter." : null}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-y border-border">
                  <SortHead label="Pair" active={sort === "symbol"} onClick={() => toggleSort("symbol")} />
                  <th className="px-3 py-2 font-medium">24h path</th>
                  <SortHead label="Last" active={sort === "lastPrice"} onClick={() => toggleSort("lastPrice")} align="right" />
                  <SortHead label="Change" active={sort === "change"} onClick={() => toggleSort("change")} align="right" />
                  <th className="px-3 py-2 text-right font-medium">Bid / Ask</th>
                  <SortHead label="Volume" active={sort === "volume"} onClick={() => toggleSort("volume")} align="right" />
                </tr>
              </thead>
              <tbody>
                {rows.map((ticker) => {
                  const tone = changeTone(ticker.change);
                  const points = sparkPoints(ticker.chart);
                  const path = points.length > 1 ? points : sparkPoints(ticker.chart7d);
                  return (
                    <tr key={ticker.symbol} className="border-b border-border/70 hover:bg-muted/40">
                      <td className="px-3 py-2.5">
                        <Link href={tradePath(ticker.symbol)} className="block">
                          <span className="font-medium">{ticker.symbol}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {ticker.baseFullName || pairParts(ticker.symbol).base}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <Sparkline values={path} up={tone !== "down"} />
                      </td>
                      <td className="num px-3 py-2.5 text-right">{formatPrice(ticker.lastPrice)}</td>
                      <td className={cn("num px-3 py-2.5 text-right", tone === "up" && "text-up", tone === "down" && "text-down")}>
                        {formatChange(ticker.change)}
                      </td>
                      <td className="num px-3 py-2.5 text-right text-xs text-muted-foreground">
                        {formatPrice(ticker.bestBid)} / {formatPrice(ticker.bestAsk)}
                      </td>
                      <td className="num px-3 py-2.5 text-right">{formatNumber(ticker.volume, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </StatusLine>
      </Panel>
    </div>
  );
}

function SortHead({
  label,
  active,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th className={cn("px-3 py-2 font-medium", align === "right" && "text-right")}>
      <button type="button" onClick={onClick} className={cn(active && "text-foreground")}>
        {label}
      </button>
    </th>
  );
}
