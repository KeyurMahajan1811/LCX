export type Side = "BUY" | "SELL";
export type OrderType = "LIMIT" | "MARKET";

export const PAPER_FEE_RATE = 0.0015;

export const STARTING_BALANCES: Record<string, number> = {
  EUR: 25_000,
  USDC: 10_000,
  BTC: 0.15,
  ETH: 1.5,
  LCX: 25_000,
};

export type MarketQuote = {
  bid: number;
  ask: number;
  last: number;
};

export type PaperOrder = {
  id: string;
  pair: string;
  base: string;
  quote: string;
  side: Side;
  orderType: OrderType;
  price: number;
  amount: number;
  filled: number;
  average: number;
  status: "OPEN" | "FILLED" | "CANCELLED";
  fee: number;
  feeCoin: string;
  createdAt: number;
  updatedAt: number;
};

export type PaperFill = {
  id: string;
  orderId: string;
  pair: string;
  side: Side;
  amount: number;
  price: number;
  fee: number;
  feeCoin: string;
  createdAt: number;
};

export type PaperState = {
  free: Record<string, number>;
  locked: Record<string, number>;
  orders: PaperOrder[];
  fills: PaperFill[];
};

export class PaperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaperError";
  }
}

export function createPaperState(): PaperState {
  return {
    free: { ...STARTING_BALANCES },
    locked: {},
    orders: [],
    fills: [],
  };
}

function round(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

function read(map: Record<string, number>, coin: string): number {
  return map[coin] ?? 0;
}

function add(map: Record<string, number>, coin: string, delta: number) {
  const next = round(read(map, coin) + delta);
  if (Math.abs(next) <= 1e-10) delete map[coin];
  else map[coin] = next;
}

export function touchPrice(side: Side, market: MarketQuote): number | null {
  const price = side === "BUY" ? market.ask || market.last : market.bid || market.last;
  return price > 0 ? price : null;
}

function crossPrice(side: Side, limit: number, market: MarketQuote): number | null {
  if (side === "BUY" && market.ask > 0 && limit >= market.ask) return market.ask;
  if (side === "SELL" && market.bid > 0 && limit <= market.bid) return market.bid;
  return null;
}

function buyLock(price: number, amount: number): number {
  return round(price * amount * (1 + PAPER_FEE_RATE));
}

type FillArgs = {
  id: string;
  pair: string;
  base: string;
  quote: string;
  side: Side;
  orderType: OrderType;
  amount: number;
  price: number;
  now: number;
};

function recordFill(state: PaperState, args: FillArgs) {
  const notional = round(args.price * args.amount);
  const fee = round(notional * PAPER_FEE_RATE);
  if (args.side === "BUY") {
    const cost = round(notional + fee);
    if (read(state.free, args.quote) + 1e-8 < cost) {
      throw new PaperError(
        `Not enough ${args.quote}. This fill costs ${cost} including the simulated fee.`,
      );
    }
    add(state.free, args.quote, -cost);
    add(state.free, args.base, args.amount);
  } else {
    if (read(state.free, args.base) + 1e-8 < args.amount) {
      throw new PaperError(`Not enough ${args.base}. Need ${args.amount}.`);
    }
    add(state.free, args.base, -args.amount);
    add(state.free, args.quote, round(notional - fee));
  }

  state.orders.unshift({
    id: args.id,
    pair: args.pair,
    base: args.base,
    quote: args.quote,
    side: args.side,
    orderType: args.orderType,
    price: args.price,
    amount: args.amount,
    filled: args.amount,
    average: args.price,
    status: "FILLED",
    fee,
    feeCoin: args.quote,
    createdAt: args.now,
    updatedAt: args.now,
  });
  state.fills.unshift({
    id: `${args.id}-fill`,
    orderId: args.id,
    pair: args.pair,
    side: args.side,
    amount: args.amount,
    price: args.price,
    fee,
    feeCoin: args.quote,
    createdAt: args.now,
  });
}

export function placeOrder(
  state: PaperState,
  input: {
    pair: string;
    base: string;
    quote: string;
    side: Side;
    orderType: OrderType;
    amount: number;
    price?: number;
    market: MarketQuote;
    now?: number;
    id?: string;
  },
): PaperState {
  const next: PaperState = structuredClone(state);
  const now = input.now ?? Date.now();
  const amount = input.amount;
  if (!(amount > 0) || !Number.isFinite(amount)) {
    throw new PaperError("Amount must be greater than zero.");
  }
  const id = input.id ?? `paper-${now}-${Math.floor(Math.random() * 1e6)}`;

  if (input.orderType === "MARKET") {
    const price = touchPrice(input.side, input.market);
    if (!price) {
      throw new PaperError("No live bid or ask on this market, so a market order cannot fill.");
    }
    recordFill(next, {
      id,
      pair: input.pair,
      base: input.base,
      quote: input.quote,
      side: input.side,
      orderType: "MARKET",
      amount,
      price,
      now,
    });
    return next;
  }

  const limit = input.price ?? 0;
  if (!(limit > 0) || !Number.isFinite(limit)) {
    throw new PaperError("Limit orders need a price above zero.");
  }
  const crossed = crossPrice(input.side, limit, input.market);
  if (crossed) {
    recordFill(next, {
      id,
      pair: input.pair,
      base: input.base,
      quote: input.quote,
      side: input.side,
      orderType: "LIMIT",
      amount,
      price: crossed,
      now,
    });
    return next;
  }

  if (input.side === "BUY") {
    const lock = buyLock(limit, amount);
    if (read(next.free, input.quote) + 1e-8 < lock) {
      throw new PaperError(
        `Not enough ${input.quote}. A resting buy locks ${lock}, including the simulated fee.`,
      );
    }
    add(next.free, input.quote, -lock);
    add(next.locked, input.quote, lock);
  } else if (read(next.free, input.base) + 1e-8 < amount) {
    throw new PaperError(`Not enough ${input.base}. Need ${amount}.`);
  } else {
    add(next.free, input.base, -amount);
    add(next.locked, input.base, amount);
  }

  next.orders.unshift({
    id,
    pair: input.pair,
    base: input.base,
    quote: input.quote,
    side: input.side,
    orderType: "LIMIT",
    price: limit,
    amount,
    filled: 0,
    average: 0,
    status: "OPEN",
    fee: 0,
    feeCoin: input.quote,
    createdAt: now,
    updatedAt: now,
  });
  return next;
}

export function cancelOrder(state: PaperState, orderId: string, now = Date.now()): PaperState {
  const next: PaperState = structuredClone(state);
  const order = next.orders.find((item) => item.id === orderId && item.status === "OPEN");
  if (!order) throw new PaperError("That order is not open.");
  if (order.side === "BUY") {
    const lock = buyLock(order.price, order.amount);
    add(next.locked, order.quote, -lock);
    add(next.free, order.quote, lock);
  } else {
    add(next.locked, order.base, -order.amount);
    add(next.free, order.base, order.amount);
  }
  order.status = "CANCELLED";
  order.updatedAt = now;
  return next;
}

export function matchOpenOrders(
  state: PaperState,
  markets: Record<string, MarketQuote>,
  now = Date.now(),
): PaperState {
  const next: PaperState = structuredClone(state);
  for (const order of next.orders) {
    if (order.status !== "OPEN") continue;
    const market = markets[order.pair];
    if (!market) continue;
    const price = crossPrice(order.side, order.price, market);
    if (!price) continue;
    const notional = round(price * order.amount);
    const fee = round(notional * PAPER_FEE_RATE);
    if (order.side === "BUY") {
      const lock = buyLock(order.price, order.amount);
      const cost = round(notional + fee);
      add(next.locked, order.quote, -lock);
      const refund = round(lock - cost);
      if (refund > 0) add(next.free, order.quote, refund);
      add(next.free, order.base, order.amount);
    } else {
      add(next.locked, order.base, -order.amount);
      add(next.free, order.quote, round(notional - fee));
    }
    order.status = "FILLED";
    order.filled = order.amount;
    order.average = price;
    order.fee = fee;
    order.updatedAt = now;
    next.fills.unshift({
      id: `${order.id}-fill`,
      orderId: order.id,
      pair: order.pair,
      side: order.side,
      amount: order.amount,
      price,
      fee,
      feeCoin: order.quote,
      createdAt: now,
    });
  }
  return next;
}

export function totalBalance(state: PaperState, coin: string): number {
  return round(read(state.free, coin) + read(state.locked, coin));
}

export function estimateEur(
  state: PaperState,
  eurPrices: Record<string, number>,
): { value: number; unpriced: string[] } {
  let value = 0;
  const unpriced: string[] = [];
  const coins = new Set([...Object.keys(state.free), ...Object.keys(state.locked)]);
  for (const coin of coins) {
    const amount = totalBalance(state, coin);
    if (amount === 0) continue;
    if (coin === "EUR") {
      value += amount;
      continue;
    }
    const price = eurPrices[coin];
    if (price && price > 0) value += amount * price;
    else unpriced.push(coin);
  }
  return { value, unpriced };
}
