import { NextRequest, NextResponse } from "next/server";
import { assertPair, lcxPublic } from "@/lib/lcx";
import type { PublicTrade } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const pair = assertPair(request.nextUrl.searchParams.get("pair") ?? "");
    const data = await lcxPublic<PublicTrade[]>("/api/trades", { pair, offset: "0" });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load trades.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
