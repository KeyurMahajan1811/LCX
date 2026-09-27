export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_APPLICANTS = 4;

export const LOAN_DOCUMENT_TYPES = [
  "DOCUMENT_1",
  "DOCUMENT_2",
  "DOCUMENT_3",
  "DOCUMENT_4",
  "DOCUMENT_5",
  "DOCUMENT_6",
  "DOCUMENT_7",
] as const;

export type LoanDocumentType = (typeof LOAN_DOCUMENT_TYPES)[number];

export const DOCUMENT_LABELS: Record<string, string> = {
  DOCUMENT_1: "Document 1",
  DOCUMENT_2: "Document 2",
  DOCUMENT_3: "Document 3",
  DOCUMENT_4: "Document 4",
  DOCUMENT_5: "Document 5",
  DOCUMENT_6: "Document 6",
  DOCUMENT_7: "Document 7",
  FINAL_CHALLAN: "Final Challan",
};

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export function extensionFor(contentType: string) {
  return ALLOWED_TYPES[contentType] ?? null;
}

export function assertFileAllowed(contentType: string, fileSizeBytes: number) {
  if (!extensionFor(contentType)) {
    throw new Error("Only PDF, JPG, and PNG files are accepted.");
  }
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0 || fileSizeBytes > MAX_FILE_BYTES) {
    throw new Error("Each file must be 2MB or smaller.");
  }
}

export function safeFileName(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "document";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "document";
}
