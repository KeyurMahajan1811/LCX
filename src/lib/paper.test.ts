import assert from "node:assert/strict";
import test from "node:test";
import {
  cancelOrder,
  createPaperState,
  matchOpenOrders,
  placeOrder,
  totalBalance,
} from "./paper";

const market = { bid: 0.023, ask: 0.06, last: 0.03 };

test("market buy spends quote and credits base", () => {
  const start = createPaperState();
  const next = placeOrder(start, {
    pair: "LCX/EUR",
    base: "LCX",
    quote: "EUR",
    side: "BUY",
    orderType: "MARKET",
    amount: 100,
    market,
    now: 1,
    id: "b1",
  });
  const cost = 100 * 0.06 * 1.0015;
  assert.ok(Math.abs(next.free.EUR - (25_000 - cost)) < 1e-6);
  assert.equal(next.free.LCX, 25_100);
  assert.equal(next.orders[0]?.status, "FILLED");
  assert.equal(next.fills[0]?.price, 0.06);
});

test("rejects a buy that the quote balance cannot cover", () => {
  const start = createPaperState();
  assert.throws(
    () =>
      placeOrder(start, {
        pair: "BTC/EUR",
        base: "BTC",
        quote: "EUR",
        side: "BUY",
        orderType: "MARKET",
        amount: 10,
        market: { bid: 60_000, ask: 61_000, last: 60_500 },
        now: 1,
        id: "b2",
      }),
    /Not enough EUR/,
  );
});

test("resting limit locks funds and fills when the book crosses", () => {
  const start = createPaperState();
  const resting = placeOrder(start, {
    pair: "LCX/EUR",
    base: "LCX",
    quote: "EUR",
    side: "BUY",
    orderType: "LIMIT",
    amount: 200,
    price: 0.02,
    market,
    now: 2,
    id: "l1",
  });
  assert.equal(resting.orders[0]?.status, "OPEN");
  assert.ok((resting.locked.EUR ?? 0) > 0);
  assert.equal(totalBalance(resting, "EUR"), 25_000);

  const filled = matchOpenOrders(
    resting,
    { "LCX/EUR": { bid: 0.019, ask: 0.02, last: 0.02 } },
    3,
  );
  assert.equal(filled.orders[0]?.status, "FILLED");
  assert.equal(filled.orders[0]?.average, 0.02);
  assert.equal(filled.free.LCX, 25_200);
  assert.equal(filled.locked.EUR, undefined);
});

test("cancel returns locked base on a sell", () => {
  const start = createPaperState();
  const resting = placeOrder(start, {
    pair: "LCX/EUR",
    base: "LCX",
    quote: "EUR",
    side: "SELL",
    orderType: "LIMIT",
    amount: 500,
    price: 0.2,
    market,
    now: 4,
    id: "s1",
  });
  assert.equal(resting.free.LCX, 24_500);
  assert.equal(resting.locked.LCX, 500);
  const cancelled = cancelOrder(resting, "s1", 5);
  assert.equal(cancelled.orders[0]?.status, "CANCELLED");
  assert.equal(cancelled.free.LCX, 25_000);
  assert.equal(cancelled.locked.LCX, undefined);
});
