import type { CanonicalStatus } from "@/lib/status";

export async function notifyStatusChange(input: {
  requestCode: string;
  toStatus: CanonicalStatus;
}) {
  // Phase 2: send mail through Resend when a request changes status.
  void input;
}
