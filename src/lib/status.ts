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
  "badge-red": "bg-red-50 text-red-700 ring-red-200",
  "badge-blue": "bg-[#EBF3FF] text-[#0066FF] ring-[#0066FF]/20",
  "badge-amber": "bg-amber-50 text-amber-800 ring-amber-200",
  "badge-green": "bg-[#E7F9F3] text-[#067A58] ring-[#00C48C]/40",
  "badge-gray": "bg-[#F4F6FA] text-[#52607A] ring-[#E4E9F2]",
};
