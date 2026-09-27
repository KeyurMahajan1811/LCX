"use client";

import { readCredentials } from "@/lib/credentials";

export async function liveRequest<T>(body: Record<string, unknown>): Promise<T> {
  const credentials = readCredentials();
  if (!credentials) {
    throw new Error("Save an LCX API key and secret on the portfolio page before using a live account.");
  }
  const response = await fetch("/api/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, ...credentials }),
  });
  const payload = (await response.json()) as { data?: T; error?: string };
  if (!response.ok) throw new Error(payload.error || "Live request failed.");
  return payload.data as T;
}
