import type { AppRole, CanonicalStatus } from "@/lib/status";

export type StatusIntent = "advance" | "complete" | "cancel";

const TERMINAL: CanonicalStatus[] = ["COMPLETED", "CANCELLED"];

export function isTerminal(status: CanonicalStatus) {
  return TERMINAL.includes(status);
}

export function resolveTransition(
  role: AppRole,
  current: CanonicalStatus,
  intent: StatusIntent,
): CanonicalStatus | null {
  if (intent === "cancel") {
    return isTerminal(current) ? null : "CANCELLED";
  }
  if (role === "VENDOR" && current === "PENDING_AT_VENDOR") {
    if (intent === "advance") return "PENDING_AT_BANK";
    if (intent === "complete") return "COMPLETED";
  }
  if (role === "BANK_OFFICIAL" && current === "PENDING_AT_BANK" && intent === "advance") {
    return "PENDING_AT_VENDOR";
  }
  return null;
}
