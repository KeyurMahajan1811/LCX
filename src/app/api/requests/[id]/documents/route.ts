import { DocumentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { loadRequest } from "@/lib/access";
import { LOAN_DOCUMENT_TYPES, MAX_FILE_BYTES } from "@/lib/documents";
import { prisma } from "@/lib/prisma";
import { assertStoredObject, ownsKey } from "@/lib/s3";
import { currentUser } from "@/lib/session";
import { documentRecordSchema } from "@/lib/validators";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const existing = await loadRequest(user, id);
  if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    return NextResponse.json({ error: "This request is closed." }, { status: 409 });
  }
  const parsed = documentRecordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the document details." }, { status: 400 });
  const { documentType } = parsed.data;
  const bankDoc = (LOAN_DOCUMENT_TYPES as readonly string[]).includes(documentType);
  if (bankDoc) {
    if (user.role !== "BANK_OFFICIAL" || existing.status !== "PENDING_AT_BANK") {
      return NextResponse.json({ error: "Documents can be replaced when the request is back with the bank." }, { status: 403 });
    }
  } else if (user.role !== "VENDOR" || existing.status !== "PENDING_AT_VENDOR") {
    return NextResponse.json({ error: "Only the vendor can upload the final challan, and only while it is their turn." }, { status: 403 });
  }
  if (!ownsKey(user.id, parsed.data.fileKey)) {
    return NextResponse.json({ error: "That upload does not belong to this session." }, { status: 400 });
  }
  try {
    await assertStoredObject(parsed.data.fileKey, MAX_FILE_BYTES);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload could not be confirmed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const latest = existing.documents.find((document) => document.documentType === documentType);
  const saved = await prisma.document.create({
    data: {
      requestId: existing.id,
      documentType: documentType as DocumentType,
      fileUrl: parsed.data.fileKey,
      fileName: parsed.data.fileName,
      fileSizeKb: parsed.data.fileSizeKb,
      uploadedById: user.id,
      uploadedByRole: user.role,
      version: (latest?.version ?? 0) + 1,
    },
  });
  return NextResponse.json({ id: saved.id, version: saved.version });
}
