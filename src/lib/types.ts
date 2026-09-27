export type ApiEnvelope<T> = {
  data: T;
  message?: string;
  status: "success" | "error";
};

export type ChartPoint = {
  Time: number;
  Close: number;
};

export type Ticker = {
  symbol: string;
  baseFullName?: string;
  quoteFullName?: string;
  bestAsk: number;
  bestBid: number;
  change: number;
  change7d?: number;
  high: number;
  low: number;
  lastPrice: number;
  last24Price: number;
  volume: number;
  usdVolume: number;
  equivalent: number;
  lastUpdated: number;
  categories?: string[];
  chart?: ChartPoint[];
  chart7d?: ChartPoint[];
};

export type TradingPair = {
  Id: string;
  Symbol: string;
  Base: string;
  Quote: string;
  Status: boolean;
  Mode: string;
  BaseFullName?: string;
  QuoteFullName?: string;
  Precision?: { Amount: number; Price: number; Total: number };
  Orderprecision?: { Amount: number; Price: number; Total: number };
  MinOrder?: { Base: number; Quote: number };
  MaxOrder?: { Base: number; Quote: number };
};

export type OrderBook = {
  buy: [number, number][];
  sell: [number, number][];
};

export type PublicTrade = [number, number, string, number];

export type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  pair?: string;
  timeframe?: string;
};

export type Side = "BUY" | "SELL";
export type OrderType = "LIMIT" | "MARKET";
