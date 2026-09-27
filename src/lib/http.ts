import { NextResponse } from "next/server";
import { LcxInputError } from "@/lib/lcx";

export function apiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof LcxInputError ? 400 : 502;
  return NextResponse.json({ error: message }, { status });
}
