export type AppRole = "BANK_OFFICIAL" | "VENDOR";
export type CanonicalStatus = "PENDING_AT_VENDOR" | "PENDING_AT_BANK" | "COMPLETED" | "CANCELLED";

export function getDisplayStatus(canonicalStatus: CanonicalStatus, viewerRole: AppRole): {
  label: string;
  colorClass: string;
} {
  if (canonicalStatus === "PENDING_AT_VENDOR") {
    return viewerRole === "VENDOR"
      ? { label: "Action Required", colorClass: "badge-red" }
      : { label: "Pending at Vendor", colorClass: "badge-blue" };
  }
  if (canonicalStatus === "PENDING_AT_BANK") {
    return viewerRole === "BANK_OFFICIAL"
      ? { label: "Action Required", colorClass: "badge-red" }
      : { label: "Pending at Bank", colorClass: "badge-amber" };
  }
  if (canonicalStatus === "COMPLETED") return { label: "Completed", colorClass: "badge-green" };
  return { label: "Cancelled", colorClass: "badge-gray" };
}

export const STATUS_BADGE_CLASS: Record<string, string> = {
  "badge-red": "bg-red-100 text-red-900 ring-red-200",
  "badge-blue": "bg-sky-100 text-sky-950 ring-sky-200",
  "badge-amber": "bg-amber-100 text-amber-950 ring-amber-200",
  "badge-green": "bg-emerald-100 text-emerald-950 ring-emerald-200",
  "badge-gray": "bg-stone-200 text-stone-700 ring-stone-300",
};
