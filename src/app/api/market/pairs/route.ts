import { NextResponse } from "next/server";
import { lcxPublic } from "@/lib/lcx";
import type { TradingPair } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await lcxPublic<TradingPair[]>("/api/pairs");
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load pairs.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
