"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Panel, StatusLine } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readCredentials, writeCredentials } from "@/lib/credentials";
import { formatNumber, formatPrice, formatTime, pairParts, tradePath } from "@/lib/format";
import { liveRequest } from "@/lib/live";
import { estimateEur, totalBalance } from "@/lib/paper";
import { usePaperBook } from "@/lib/paper-store";
import type { Ticker } from "@/lib/types";

type LiveBalance = {
  coin: string;
  fullName?: string;
  balance?: { freeBalance: number; occupiedBalance: number; totalBalance: number };
};

type LiveOrder = {
  Id?: string;
  Pair?: string;
  Side?: string;
  OrderType?: string;
  Price?: number;
  Amount?: number;
  Status?: string;
  Filled?: number;
  CreatedAt?: number;
};

export function PortfolioView() {
  const paper = usePaperBook();
  const matchRef = useRef(paper.match);
  matchRef.current = paper.match;
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [saved, setSaved] = useState(false);
  const [liveBalances, setLiveBalances] = useState<LiveBalance[] | null>(null);
  const [liveOrders, setLiveOrders] = useState<LiveOrder[] | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  useEffect(() => {
    const existing = readCredentials();
    setSaved(Boolean(existing));
    if (existing) setApiKey(existing.apiKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/market/tickers");
        const body = (await response.json()) as { data?: Record<string, Ticker> };
        if (!cancelled && body.data) {
          setTickers(body.data);
          const markets: Record<string, { bid: number; ask: number; last: number }> = {};
          for (const ticker of Object.values(body.data)) {
            markets[ticker.symbol] = { bid: ticker.bestBid, ask: ticker.bestAsk, last: ticker.lastPrice };
          }
          matchRef.current(markets);
        }
      } catch {
        /* valuation can wait for the next visit */
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const eurPrices = useMemo(() => {
    const prices: Record<string, number> = {};
    for (const ticker of Object.values(tickers)) {
      const { base, quote } = pairParts(ticker.symbol);
      if (quote !== "EUR" || !(ticker.lastPrice > 0)) continue;
      prices[base] = ticker.lastPrice;
    }
    return prices;
  }, [tickers]);

  const estimate = paper.state ? estimateEur(paper.state, eurPrices) : { value: 0, unpriced: [] };
  const coins = paper.state
    ? [...new Set([...Object.keys(paper.state.free), ...Object.keys(paper.state.locked)])].sort()
    : [];
  const openOrders = paper.state?.orders.filter((order) => order.status === "OPEN") ?? [];

  function saveKeys() {
    if (!apiKey.trim() || !secret.trim()) return;
    writeCredentials({ apiKey: apiKey.trim(), secret: secret.trim() });
    setSaved(true);
    setSecret("");
  }

  function forgetKeys() {
    writeCredentials(null);
    setSaved(false);
    setApiKey("");
    setSecret("");
    setLiveBalances(null);
    setLiveOrders(null);
  }

  async function refreshLive() {
    setLiveLoading(true);
    setLiveError(null);
    try {
      const [balances, orders] = await Promise.all([
        liveRequest<LiveBalance[]>({ action: "balances" }),
        liveRequest<LiveOrder[]>({ action: "open" }),
      ]);
      setLiveBalances(Array.isArray(balances) ? balances : []);
      setLiveOrders(Array.isArray(orders) ? orders : []);
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : "Could not read the live account.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function cancelLive(orderId: string) {
    setLiveError(null);
    try {
      await liveRequest({ action: "cancel", orderId });
      await refreshLive();
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : "Cancel failed.");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The paper book starts with a practice balance and never leaves this browser. Live balances and orders use
          an LCX API key, signed on the server for a single request and not stored there.
        </p>
      </div>

      <Tabs defaultValue="paper">
        <TabsList>
          <TabsTrigger value="paper">Paper book</TabsTrigger>
          <TabsTrigger value="live">Live account</TabsTrigger>
        </TabsList>
        <TabsContent value="paper" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Summary label="Estimated EUR" value={paper.ready ? formatNumber(estimate.value, 2) : "—"} />
            <Summary label="Open orders" value={String(openOrders.length)} />
            <Summary label="Fills" value={String(paper.state?.fills.length ?? 0)} />
          </div>
          {estimate.unpriced.length > 0 && (
            <p className="text-xs text-muted-foreground">
              No EUR market for {estimate.unpriced.join(", ")}, so those coins are left out of the estimate.
            </p>
          )}
          <Panel
            title="Balances"
            action={
              <Button variant="outline" size="sm" onClick={() => paper.reset()} disabled={!paper.ready}>
                Reset paper book
              </Button>
            }
          >
            <StatusLine loading={!paper.ready}>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 font-medium">Coin</th>
                    <th className="px-3 py-2 text-right font-medium">Free</th>
                    <th className="px-3 py-2 text-right font-medium">Locked</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {coins.map((coin) => (
                    <tr key={coin} className="border-b border-border/70">
                      <td className="px-3 py-2">{coin}</td>
                      <td className="num px-3 py-2 text-right">{formatNumber(paper.state?.free[coin] ?? 0, 8)}</td>
                      <td className="num px-3 py-2 text-right">{formatNumber(paper.state?.locked[coin] ?? 0, 8)}</td>
                      <td className="num px-3 py-2 text-right">
                        {formatNumber(paper.state ? totalBalance(paper.state, coin) : 0, 8)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </StatusLine>
          </Panel>
          <Panel title="Working orders">
            <StatusLine
              loading={!paper.ready}
              empty={openOrders.length === 0 ? "No resting paper orders." : null}
            >
              <OrderTable
                rows={openOrders.map((order) => ({
                  id: order.id,
                  pair: order.pair,
                  side: order.side,
                  type: order.orderType,
                  price: order.price,
                  amount: order.amount,
                  status: order.status,
                  time: order.createdAt,
                }))}
                onCancel={(id) => paper.cancel(id)}
              />
            </StatusLine>
          </Panel>
          <Panel title="Fills">
            <StatusLine
              loading={!paper.ready}
              empty={!paper.state?.fills.length ? "Fills show up after a paper order trades." : null}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">Pair</th>
                      <th className="px-3 py-2 font-medium">Side</th>
                      <th className="px-3 py-2 text-right font-medium">Price</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                      <th className="px-3 py-2 text-right font-medium">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paper.state?.fills.map((fill) => (
                      <tr key={fill.id} className="border-b border-border/70">
                        <td className="px-3 py-2 text-muted-foreground">{formatTime(fill.createdAt)}</td>
                        <td className="px-3 py-2">
                          <Link href={tradePath(fill.pair)} className="hover:underline">
                            {fill.pair}
                          </Link>
                        </td>
                        <td className={fill.side === "BUY" ? "px-3 py-2 text-up" : "px-3 py-2 text-down"}>{fill.side}</td>
                        <td className="num px-3 py-2 text-right">{formatPrice(fill.price)}</td>
                        <td className="num px-3 py-2 text-right">{formatNumber(fill.amount, 6)}</td>
                        <td className="num px-3 py-2 text-right">
                          {formatNumber(fill.fee, 6)} {fill.feeCoin}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </StatusLine>
          </Panel>
        </TabsContent>
        <TabsContent value="live" className="mt-4 space-y-4">
          <Panel title="API keys">
            <div className="grid gap-3 p-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <p className="text-sm text-muted-foreground">
                  Create a key under LCX Settings, API Management. The secret stays in this browser&apos;s local
                  storage. Clearing it here removes it from this device.
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="api-key">API key</Label>
                <Input id="api-key" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="api-secret">Secret</Label>
                <Input
                  id="api-secret"
                  type="password"
                  value={secret}
                  placeholder={saved ? "Secret saved. Enter a new one to replace it." : "Shown once by LCX"}
                  onChange={(event) => setSecret(event.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button onClick={saveKeys} disabled={!apiKey.trim() || !secret.trim()}>
                  Save keys
                </Button>
                <Button variant="outline" onClick={forgetKeys} disabled={!saved && !apiKey}>
                  Forget keys
                </Button>
                <Button variant="secondary" onClick={refreshLive} disabled={!saved || liveLoading}>
                  {liveLoading ? "Reading account…" : "Load balances"}
                </Button>
              </div>
              {liveError && <p className="text-sm text-down sm:col-span-2">{liveError}</p>}
            </div>
          </Panel>
          <Panel title="Exchange balances">
            <StatusLine
              loading={liveLoading && !liveBalances}
              empty={!liveBalances ? "Load balances after saving a key." : liveBalances.length === 0 ? "No balances returned." : null}
            >
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 font-medium">Coin</th>
                    <th className="px-3 py-2 text-right font-medium">Free</th>
                    <th className="px-3 py-2 text-right font-medium">In orders</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(liveBalances ?? [])
                    .filter((row) => (row.balance?.totalBalance ?? 0) > 0)
                    .map((row) => (
                      <tr key={row.coin} className="border-b border-border/70">
                        <td className="px-3 py-2">
                          {row.coin}
                          <span className="ml-2 text-xs text-muted-foreground">{row.fullName}</span>
                        </td>
                        <td className="num px-3 py-2 text-right">{formatNumber(row.balance?.freeBalance, 8)}</td>
                        <td className="num px-3 py-2 text-right">{formatNumber(row.balance?.occupiedBalance, 8)}</td>
                        <td className="num px-3 py-2 text-right">{formatNumber(row.balance?.totalBalance, 8)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </StatusLine>
          </Panel>
          <Panel title="Live open orders">
            <StatusLine
              empty={!liveOrders ? "Open orders appear after you load the account." : liveOrders.length === 0 ? "No open live orders." : null}
            >
              <OrderTable
                rows={(liveOrders ?? []).map((order) => ({
                  id: order.Id ?? "",
                  pair: order.Pair ?? "",
                  side: order.Side ?? "",
                  type: order.OrderType ?? "",
                  price: order.Price ?? 0,
                  amount: order.Amount ?? 0,
                  status: order.Status ?? "",
                  time: order.CreatedAt ?? 0,
                }))}
                onCancel={(id) => cancelLive(id)}
              />
            </StatusLine>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-xs tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="num mt-1 text-xl">{value}</div>
    </div>
  );
}

function OrderTable({
  rows,
  onCancel,
}: {
  rows: { id: string; pair: string; side: string; type: string; price: number; amount: number; status: string; time: number }[];
  onCancel: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-2 font-medium">Pair</th>
            <th className="px-3 py-2 font-medium">Side</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 text-right font-medium">Price</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border/70">
              <td className="px-3 py-2">
                {row.pair.includes("/") ? (
                  <Link href={tradePath(row.pair)} className="hover:underline">
                    {row.pair}
                  </Link>
                ) : (
                  row.pair
                )}
              </td>
              <td className={row.side === "BUY" ? "px-3 py-2 text-up" : "px-3 py-2 text-down"}>{row.side}</td>
              <td className="px-3 py-2">{row.type}</td>
              <td className="num px-3 py-2 text-right">{formatPrice(row.price)}</td>
              <td className="num px-3 py-2 text-right">{formatNumber(row.amount, 6)}</td>
              <td className="px-3 py-2">{row.status}</td>
              <td className="px-3 py-2 text-right">
                <Button variant="outline" size="sm" onClick={() => onCancel(row.id)}>
                  Cancel
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
