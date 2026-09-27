"use client";

import { useCallback, useEffect, useState } from "react";
import {
  cancelOrder,
  createPaperState,
  matchOpenOrders,
  placeOrder,
  type MarketQuote,
  type PaperState,
} from "@/lib/paper";

const KEY = "lcx-desk-paper-v1";

function load(): PaperState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return createPaperState();
    const parsed = JSON.parse(raw) as PaperState;
    if (!parsed.free || !parsed.orders || !parsed.fills) return createPaperState();
    return parsed;
  } catch {
    return createPaperState();
  }
}

export function usePaperBook() {
  const [state, setState] = useState<PaperState | null>(null);

  useEffect(() => {
    setState(load());
  }, []);

  const commit = useCallback((next: PaperState) => {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    setState(next);
  }, []);

  const submit = useCallback(
    (input: Parameters<typeof placeOrder>[1]) => {
      const current = state ?? load();
      const next = placeOrder(current, input);
      commit(next);
      return next;
    },
    [commit, state],
  );

  const cancel = useCallback(
    (orderId: string) => {
      const current = state ?? load();
      commit(cancelOrder(current, orderId));
    },
    [commit, state],
  );

  const match = useCallback(
    (markets: Record<string, MarketQuote>) => {
      const current = state ?? load();
      const next = matchOpenOrders(current, markets);
      if (JSON.stringify(next) !== JSON.stringify(current)) commit(next);
    },
    [commit, state],
  );

  const reset = useCallback(() => {
    commit(createPaperState());
  }, [commit]);

  return { state, submit, cancel, match, reset, ready: state !== null };
}
