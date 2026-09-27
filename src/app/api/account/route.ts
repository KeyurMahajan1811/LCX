import { NextRequest, NextResponse } from "next/server";
import { assertPair, lcxSigned } from "@/lib/lcx";

export const dynamic = "force-dynamic";

type AccountBody = {
  action?: string;
  apiKey?: string;
  secret?: string;
  pair?: string;
  coin?: string;
  orderId?: string;
  order?: {
    Pair?: string;
    Amount?: number;
    Price?: number;
    OrderType?: "LIMIT" | "MARKET";
    Side?: "BUY" | "SELL";
  };
};

export async function POST(request: NextRequest) {
  let body: AccountBody;
  try {
    body = (await request.json()) as AccountBody;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const apiKey = body.apiKey?.trim() ?? "";
  const secret = body.secret?.trim() ?? "";
  if (!apiKey || !secret) {
    return NextResponse.json(
      { error: "Add an LCX API key and secret on the portfolio page." },
      { status: 401 },
    );
  }

  try {
    const data = await dispatch(body.action, { apiKey, secret }, body);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LCX account request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function dispatch(
  action: string | undefined,
  auth: { apiKey: string; secret: string },
  body: AccountBody,
) {
  switch (action) {
    case "balances":
      return lcxSigned({ method: "GET", endpoint: "/api/balances", ...auth });
    case "open":
      return lcxSigned({
        method: "GET",
        endpoint: "/api/open",
        ...auth,
        params: { offset: "1", ...(body.pair ? { pair: assertPair(body.pair) } : {}) },
      });
    case "history":
      return lcxSigned({
        method: "GET",
        endpoint: "/api/orderHistory",
        ...auth,
        params: { offset: "1", ...(body.pair ? { pair: assertPair(body.pair) } : {}) },
      });
    case "fills":
      return lcxSigned({
        method: "GET",
        endpoint: "/api/uHistory",
        ...auth,
        params: { offset: "1", ...(body.pair ? { pair: assertPair(body.pair) } : {}) },
      });
    case "create": {
      const order = body.order;
      if (!order?.Pair || !order.Amount || !order.OrderType || !order.Side) {
        throw new Error("A live order needs pair, amount, side, and type.");
      }
      const pair = assertPair(order.Pair);
      if (!(order.Amount > 0)) throw new Error("Amount must be greater than zero.");
      if (order.OrderType === "LIMIT" && !(Number(order.Price) > 0)) {
        throw new Error("Limit orders need a price.");
      }
      const payload: Record<string, unknown> = {
        Pair: pair,
        Amount: order.Amount,
        OrderType: order.OrderType,
        Side: order.Side,
      };
      if (order.OrderType === "LIMIT") payload.Price = order.Price;
      return lcxSigned({ method: "POST", endpoint: "/api/create", ...auth, body: payload });
    }
    case "cancel":
      if (!body.orderId) throw new Error("Cancel needs an order id.");
      return lcxSigned({
        method: "DELETE",
        endpoint: "/api/cancel",
        ...auth,
        params: { orderId: body.orderId },
      });
    default:
      throw new Error("Unknown account action.");
  }
}
