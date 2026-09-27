export function formatWhen(value: string | Date) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAadhaar(value: string) {
  return value.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}
