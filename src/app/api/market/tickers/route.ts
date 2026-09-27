import { NextResponse } from "next/server";
import { lcxPublic } from "@/lib/lcx";
import type { Ticker } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await lcxPublic<Record<string, Ticker>>("/api/tickers");
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load tickers.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
