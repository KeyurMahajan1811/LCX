# LCX Desk

A market terminal for [LCX Exchange](https://lcx.com). It reads public prices, order books, candles, and prints from the LCX API, and it keeps a paper trading book in the browser. If you add an LCX API key, the same ticket can place and cancel live orders.

`cursor-prompt-lcx-app.md` was not in this workspace, so the app follows the public LCX exchange surface: markets, a trade desk, and a portfolio.

## Run

```bash
npm install
npm run dev
```

The dev server uses port **38421**:

```bash
npm run dev -- --port 38421
```

Open [http://127.0.0.1:38421](http://127.0.0.1:38421).

## What you can do

- Scan pairs, filter by quote currency, and sort by price, change, or volume.
- Open a market for candles, the order book, and recent public trades.
- Buy and sell in the paper book. Market orders fill at the live touch. Limit orders rest until the book crosses them, and funds stay locked until then. The simulated fee is 0.15%.
- Reset the paper book from the portfolio page. Starting balances are 25,000 EUR, 10,000 USDC, 0.15 BTC, 1.5 ETH, and 25,000 LCX.
- Optional: save an LCX API key and secret in this browser, load live balances and open orders, and send a confirmed live order. The app signs each request with HMAC-SHA256 and does not write the secret to the server.

## Checks

```bash
npm test
npm run lint
```
