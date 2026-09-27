import { NextRequest, NextResponse } from "next/server";
import { assertPair, lcxPublic } from "@/lib/lcx";
import type { OrderBook } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const pair = assertPair(request.nextUrl.searchParams.get("pair") ?? "");
    const data = await lcxPublic<OrderBook>("/api/book", { pair });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the order book.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
