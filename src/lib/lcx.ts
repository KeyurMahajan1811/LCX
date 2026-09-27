import { createHmac } from "node:crypto";
import type { ApiEnvelope } from "@/lib/types";

const EXCHANGE = "https://exchange-api.lcx.com";
const KLINE = "https://api-kline.lcx.com";
const API_VERSION = "1.1.0";

const PAIR = /^[A-Za-z0-9.]{1,16}\/[A-Za-z0-9.]{1,16}$/;

export class LcxInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LcxInputError";
  }
}

export function assertPair(pair: string): string {
  const value = pair.trim().toUpperCase();
  if (!PAIR.test(value)) throw new LcxInputError("Pair must look like LCX/EUR.");
  return value;
}

async function readJson<T>(response: Response): Promise<ApiEnvelope<T>> {
  const text = await response.text();
  let body: ApiEnvelope<T>;
  try {
    body = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new Error(`LCX returned a non-JSON response (${response.status}).`);
  }
  if (!response.ok || body.status === "error") {
    throw new Error(body.message || `LCX request failed (${response.status}).`);
  }
  return body;
}

export async function lcxPublic<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(path, EXCHANGE);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", "API-VERSION": API_VERSION },
    cache: "no-store",
  });
  const body = await readJson<T>(response);
  return body.data;
}

export async function lcxKline<T>(params: Record<string, string>): Promise<T> {
  const url = new URL("/v1/market/kline", KLINE);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  const body = await readJson<T>(response);
  return body.data;
}

type SignedRequest = {
  method: "GET" | "POST" | "DELETE";
  endpoint: string;
  apiKey: string;
  secret: string;
  params?: Record<string, string>;
  body?: Record<string, unknown>;
};

export async function lcxSigned<T>(request: SignedRequest): Promise<T> {
  const payload = request.method === "POST" && request.body ? JSON.stringify(request.body) : "{}";
  const signature = createHmac("sha256", request.secret)
    .update(request.method + request.endpoint + payload)
    .digest("base64");
  const url = new URL(request.endpoint, EXCHANGE);
  for (const [key, value] of Object.entries(request.params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "API-VERSION": API_VERSION,
      "x-access-key": request.apiKey,
      "x-access-sign": signature,
      "x-access-timestamp": Date.now().toString(),
    },
    body: request.method === "POST" ? payload : undefined,
    cache: "no-store",
  });
  const body = await readJson<T>(response);
  return body.data;
}
