"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CandleChart } from "@/components/candle-chart";
import { Panel, StatusLine } from "@/components/shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeTone, formatChange, formatNumber, formatPrice, formatTime } from "@/lib/format";
import { liveRequest } from "@/lib/live";
import { readCredentials } from "@/lib/credentials";
import { PAPER_FEE_RATE } from "@/lib/paper";
import { usePaperBook } from "@/lib/paper-store";
import type { Candle, OrderBook, OrderType, PublicTrade, Side, Ticker } from "@/lib/types";
import { cn } from "cn";

const RESOLUTIONS = [
  { id: "60", label: "1h" },
  { id: "240", label: "4h" },
  { id: "1D", label: "1D" },
  { id: "1W", label: "1W" },
];

export function TradeDesk({ base, quote }: { base: string; quote: string }) {
  const pair = `${base}/${quote}`;
  const paper = usePaperBook();
  const matchRef = useRef(paper.match);
  matchRef.current = paper.match;
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [book, setBook] = useState<OrderBook | null>(null);
  const [trades, setTrades] = useState<PublicTrade[] | null>(null);
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [resolution, setResolution] = useState("1D");
  const [error, setError] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [side, setSide] = useState<Side>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("LIMIT");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmLive, setConfirmLive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);

  useEffect(() => {
    setHasKeys(Boolean(readCredentials()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadTicker() {
      try {
        const response = await fetch("/api/market/tickers");
        const body = (await response.json()) as { data?: Record<string, Ticker>; error?: string };
        if (!response.ok) throw new Error(body.error || "Ticker request failed.");
        const next = body.data?.[pair];
        if (!next) throw new Error(`${pair} is not listed on LCX.`);
        if (!cancelled) {
          setTicker(next);
          setError(null);
          matchRef.current({
            [pair]: { bid: next.bestBid, ask: next.bestAsk, last: next.lastPrice },
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this market.");
      }
    }
    loadTicker();
    const timer = window.setInterval(loadTicker, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pair]);

  useEffect(() => {
    let cancelled = false;
    async function loadDepth() {
      try {
        const [bookRes, tradeRes] = await Promise.all([
          fetch(`/api/market/book?pair=${encodeURIComponent(pair)}`),
          fetch(`/api/market/trades?pair=${encodeURIComponent(pair)}`),
        ]);
        const bookBody = (await bookRes.json()) as { data?: OrderBook; error?: string };
        const tradeBody = (await tradeRes.json()) as { data?: PublicTrade[]; error?: string };
        if (!bookRes.ok) throw new Error(bookBody.error || "Order book failed.");
        if (!cancelled) {
          setBook(bookBody.data ?? { buy: [], sell: [] });
          setTrades(tradeRes.ok ? tradeBody.data ?? [] : []);
          setBookError(tradeRes.ok ? null : tradeBody.error || null);
        }
      } catch (err) {
        if (!cancelled) setBookError(err instanceof Error ? err.message : "Depth failed.");
      }
    }
    loadDepth();
    const timer = window.setInterval(loadDepth, 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pair]);

  useEffect(() => {
    let cancelled = false;
    setCandles(null);
    async function loadCandles() {
      try {
        const response = await fetch(
          `/api/market/kline?pair=${encodeURIComponent(pair)}&resolution=${resolution}`,
        );
        const body = (await response.json()) as { data?: Candle[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Candle request failed.");
        if (!cancelled) setCandles(body.data ?? []);
      } catch {
        if (!cancelled) setCandles([]);
      }
    }
    loadCandles();
    return () => {
      cancelled = true;
    };
  }, [pair, resolution]);

  const bids = useMemo(
    () => [...(book?.buy ?? [])].filter((row) => row[1] > 0).sort((a, b) => b[0] - a[0]).slice(0, 14),
    [book],
  );
  const asks = useMemo(
    () => [...(book?.sell ?? [])].filter((row) => row[1] > 0).sort((a, b) => a[0] - b[0]).slice(0, 14),
    [book],
  );
  const maxSize = Math.max(1, ...bids.map((row) => row[1]), ...asks.map((row) => row[1]));
  const spread =
    ticker && ticker.bestAsk > 0 && ticker.bestBid > 0
      ? ((ticker.bestAsk - ticker.bestBid) / ((ticker.bestAsk + ticker.bestBid) / 2)) * 100
      : null;
  const tone = changeTone(ticker?.change ?? 0);
  const freeBase = paper.state?.free[base] ?? 0;
  const freeQuote = paper.state?.free[quote] ?? 0;

  function useBookPrice(next: number) {
    if (next > 0) setPrice(String(next));
    setOrderType("LIMIT");
  }

  async function submit(confirmed = false) {
    setFormError(null);
    setNotice(null);
    const size = Number(amount);
    const limit = Number(price);
    if (!(size > 0)) {
      setFormError("Enter an amount greater than zero.");
      return;
    }
    if (orderType === "LIMIT" && !(limit > 0)) {
      setFormError("Enter a limit price.");
      return;
    }
    if (mode === "live") {
      if (!hasKeys) {
        setFormError("Save API keys on the portfolio page before sending a live order.");
        return;
      }
      if (!confirmed) {
        setConfirmLive(true);
        return;
      }
      setSubmitting(true);
      try {
        await liveRequest({
          action: "create",
          order: {
            Pair: pair,
            Amount: size,
            OrderType: orderType,
            Side: side,
            ...(orderType === "LIMIT" ? { Price: limit } : {}),
          },
        });
        setNotice("LCX accepted the live order. Check open orders on the portfolio page.");
        setConfirmLive(false);
        setAmount("");
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Live order failed.");
        setConfirmLive(false);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    try {
      paper.submit({
        pair,
        base,
        quote,
        side,
        orderType,
        amount: size,
        price: orderType === "LIMIT" ? limit : undefined,
        market: {
          bid: ticker?.bestBid ?? 0,
          ask: ticker?.bestAsk ?? 0,
          last: ticker?.lastPrice ?? 0,
        },
      });
      setNotice(
        orderType === "MARKET"
          ? "Paper order filled against the current touch."
          : "Paper order is working, or filled if it crossed the book.",
      );
      setAmount("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Paper order failed.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Markets
            </Link>{" "}
            / {pair}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {ticker?.baseFullName || base} <span className="text-muted-foreground">/ {quote}</span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <Stat label="Last" value={formatPrice(ticker?.lastPrice)} tone={tone} />
          <Stat label="24h" value={formatChange(ticker?.change)} tone={tone} />
          <Stat label="High" value={formatPrice(ticker?.high)} />
          <Stat label="Low" value={formatPrice(ticker?.low)} />
          <Stat label="Volume" value={formatNumber(ticker?.volume, 2)} />
        </div>
      </div>

      {error && <p className="rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Panel
            title="Candles"
            action={
              <div className="flex gap-1">
                {RESOLUTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setResolution(item.id)}
                    className={cn(
                      "rounded px-2 py-0.5 text-xs",
                      resolution === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            }
          >
            {candles === null ? (
              <p className="px-3 py-16 text-center text-sm text-muted-foreground">Loading candles…</p>
            ) : (
              <CandleChart candles={candles} />
            )}
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Order book">
              <StatusLine loading={!book && !bookError} error={bookError}>
                <div className="grid grid-cols-[1fr_1fr_1fr] px-3 py-1 text-[11px] text-muted-foreground">
                  <span>Price</span>
                  <span className="text-right">Size</span>
                  <span className="text-right">{quote}</span>
                </div>
                <div className="flex flex-col-reverse">
                  {asks.map(([px, size]) => (
                    <BookRow key={`a-${px}`} price={px} size={size} max={maxSize} side="SELL" onPick={useBookPrice} />
                  ))}
                </div>
                <div className="border-y border-border px-3 py-1.5 text-xs text-muted-foreground">
                  Spread {spread == null ? "—" : `${spread.toFixed(2)}%`}
                  {spread != null && spread > 2 ? " · wide book, market orders pay the touch" : ""}
                </div>
                {bids.map(([px, size]) => (
                  <BookRow key={`b-${px}`} price={px} size={size} max={maxSize} side="BUY" onPick={useBookPrice} />
                ))}
                {bids.length === 0 && asks.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">The book is empty.</p>
                )}
              </StatusLine>
            </Panel>
            <Panel title="Public trades">
              <StatusLine loading={!trades} empty={trades && trades.length === 0 ? "No public prints yet." : null}>
                <div className="max-h-80 overflow-auto">
                  {(trades ?? []).slice(0, 30).map((trade, index) => {
                    const [px, size, tradeSide, time] = trade;
                    return (
                      <div key={`${time}-${index}`} className="grid grid-cols-3 px-3 py-1 text-xs">
                        <span className={cn("num", tradeSide === "BUY" ? "text-up" : "text-down")}>{formatPrice(px)}</span>
                        <span className="num text-right">{formatNumber(size, 4)}</span>
                        <span className="text-right text-muted-foreground">{formatTime(time)}</span>
                      </div>
                    );
                  })}
                </div>
              </StatusLine>
            </Panel>
          </div>
        </div>

        <Panel title="Order ticket">
          <div className="space-y-3 p-3">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(["paper", "live"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className={cn(
                    "rounded-md py-1 text-sm",
                    mode === item ? "bg-background text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item === "paper" ? "Paper" : "Live"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(["BUY", "SELL"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSide(item)}
                  className={cn(
                    "rounded-md border py-1.5 text-sm font-medium",
                    side === item && item === "BUY" && "border-up bg-up/15 text-up",
                    side === item && item === "SELL" && "border-down bg-down/15 text-down",
                    side !== item && "border-transparent bg-muted text-muted-foreground",
                  )}
                >
                  {item === "BUY" ? "Buy" : "Sell"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(["LIMIT", "MARKET"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setOrderType(item)}
                  className={cn(
                    "rounded-md py-1 text-xs",
                    orderType === item ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {item === "LIMIT" ? "Limit" : "Market"}
                </button>
              ))}
            </div>
            {orderType === "LIMIT" && (
              <Field label={`Price (${quote})`}>
                <Input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" />
              </Field>
            )}
            <Field label={`Amount (${base})`}>
              <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
            </Field>
            <p className="text-xs text-muted-foreground">
              {mode === "paper" ? (
                <>
                  Paper balances: {formatNumber(freeBase, 6)} {base} free · {formatNumber(freeQuote, 2)} {quote} free.
                  Simulated fee {(PAPER_FEE_RATE * 100).toFixed(2)}%.
                </>
              ) : (
                <>
                  Live orders are signed and sent to LCX.{" "}
                  {hasKeys ? "Keys are saved in this browser." : "No keys saved yet."}
                </>
              )}
            </p>
            {formError && <p className="text-sm text-down">{formError}</p>}
            {notice && <p className="text-sm text-up">{notice}</p>}
            <Button
              className={cn("w-full", side === "BUY" ? "bg-up text-black hover:bg-up/90" : "bg-down text-white hover:bg-down/90")}
              disabled={submitting || !paper.ready}
              onClick={() => submit(false)}
            >
              {submitting ? "Sending…" : `${side === "BUY" ? "Buy" : "Sell"} ${base}`}
            </Button>
            <Link href="/portfolio" className="block text-center text-xs text-muted-foreground hover:text-foreground">
              Open portfolio and working orders
            </Link>
          </div>
        </Panel>
      </div>

      <Dialog open={confirmLive} onOpenChange={setConfirmLive}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this order to LCX?</DialogTitle>
            <DialogDescription>
              {side} {amount || "—"} {base} on {pair}
              {orderType === "LIMIT" ? ` at ${price} ${quote}` : " at market"}. This uses the API key stored in this
              browser and places a real exchange order.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmLive(false)}>
              Keep it
            </Button>
            <Button onClick={() => submit(true)} disabled={submitting}>
              Place live order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, tone = "flat" }: { label: string; value: string; tone?: "up" | "down" | "flat" }) {
  return (
    <div>
      <div className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className={cn("num text-base", tone === "up" && "text-up", tone === "down" && "text-down")}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function BookRow({
  price,
  size,
  max,
  side,
  onPick,
}: {
  price: number;
  size: number;
  max: number;
  side: Side;
  onPick: (price: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(price)}
      className="relative grid w-full grid-cols-3 px-3 py-0.5 text-left text-xs hover:bg-muted/50"
    >
      <span
        className={cn("absolute inset-y-0 right-0", side === "BUY" ? "bg-up/10" : "bg-down/10")}
        style={{ width: `${Math.min(100, (size / max) * 100)}%` }}
      />
      <span className={cn("num relative", side === "BUY" ? "text-up" : "text-down")}>{formatPrice(price)}</span>
      <span className="num relative text-right">{formatNumber(size, 4)}</span>
      <span className="num relative text-right text-muted-foreground">{formatNumber(price * size, 2)}</span>
    </button>
  );
}
