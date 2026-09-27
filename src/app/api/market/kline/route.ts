import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { assertPair, lcxKline } from "@/lib/lcx";
import type { Candle } from "@/lib/types";

export const dynamic = "force-dynamic";

const RESOLUTIONS = new Set(["1", "5", "15", "30", "60", "240", "1D", "1W"]);

export async function GET(request: NextRequest) {
  try {
    const pair = assertPair(request.nextUrl.searchParams.get("pair") ?? "");
    const resolution = request.nextUrl.searchParams.get("resolution") ?? "1D";
    if (!RESOLUTIONS.has(resolution)) {
      return NextResponse.json({ error: "Unsupported candle resolution." }, { status: 400 });
    }
    const now = Math.floor(Date.now() / 1000);
    const span = resolution === "1D" || resolution === "1W" ? 60 * 60 * 24 * 180 : 60 * 60 * 24 * 14;
    const from = request.nextUrl.searchParams.get("from") ?? String(now - span);
    const to = request.nextUrl.searchParams.get("to") ?? String(now);
    const data = await lcxKline<Candle[]>({ pair, resolution, from, to });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Could not load candles.");
  }
}
