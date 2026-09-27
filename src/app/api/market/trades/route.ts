import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { assertPair, lcxPublic } from "@/lib/lcx";
import type { PublicTrade } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const pair = assertPair(request.nextUrl.searchParams.get("pair") ?? "");
    const data = await lcxPublic<PublicTrade[]>("/api/trades", { pair, offset: "0" });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Could not load trades.");
  }
}
