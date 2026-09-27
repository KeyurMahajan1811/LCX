import { z } from "zod";
import { LOAN_DOCUMENT_TYPES, MAX_APPLICANTS } from "@/lib/documents";

export const applicantSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the full name.").max(120),
  panCard: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN must look like ABCDE1234F."),
  aadhaarCard: z.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits."),
  mobileNo: z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number."),
  email: z.string().trim().email("Enter a valid email."),
});

export const applicantsSchema = z.object({
  applicants: z.array(applicantSchema).min(1).max(MAX_APPLICANTS),
});

export const storedDocumentSchema = z.object({
  documentType: z.enum(LOAN_DOCUMENT_TYPES),
  fileKey: z.string().min(8).max(400),
  fileName: z.string().min(1).max(180),
  fileSizeKb: z.number().int().positive().max(2048),
});

export const createRequestSchema = applicantsSchema.extend({
  documents: z.array(storedDocumentSchema).length(7),
});

export const presignSchema = z.object({
  fileName: z.string().min(1).max(180),
  contentType: z.string().min(1),
  fileSizeBytes: z.number().int().positive(),
});

export const documentRecordSchema = storedDocumentSchema.extend({
  documentType: z.enum([...LOAN_DOCUMENT_TYPES, "FINAL_CHALLAN"]),
});

export const actionSchema = z.object({
  message: z.string().trim().min(5, "Write at least a short note.").max(2000),
});

export const statusSchema = z.object({
  intent: z.enum(["advance", "complete"]),
  note: z.string().trim().max(2000).optional(),
});

export const cancelSchema = z.object({
  reason: z.string().trim().min(5, "A cancellation reason is required.").max(2000),
});
