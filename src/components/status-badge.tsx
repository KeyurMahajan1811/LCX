import { STATUS_BADGE_CLASS, getDisplayStatus, type AppRole, type CanonicalStatus } from "@/lib/status";
import { cn } from "cn";

export function StatusBadge({ status, role }: { status: CanonicalStatus; role: AppRole }) {
  const display = getDisplayStatus(status, role);
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1", STATUS_BADGE_CLASS[display.colorClass])}>
      {display.label}
    </span>
  );
}
