import { DocumentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { nextRequestCode } from "@/lib/access";
import { MAX_FILE_BYTES } from "@/lib/documents";
import { notifyStatusChange } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { assertStoredObject, ownsKey } from "@/lib/s3";
import { currentUser } from "@/lib/session";
import { createRequestSchema } from "@/lib/validators";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const requests = await prisma.loanRequest.findMany({
    where: user.role === "BANK_OFFICIAL" ? { bankId: user.bankId ?? "__none__" } : {},
    orderBy: { updatedAt: "desc" },
    include: {
      bank: { select: { name: true } },
      applicants: { orderBy: { sequenceNo: "asc" }, select: { fullName: true, sequenceNo: true } },
      documents: {
        select: { id: true, documentType: true, fileName: true, version: true, uploadedAt: true, fileSizeKb: true },
        orderBy: [{ documentType: "asc" }, { version: "desc" }],
      },
    },
  });
  return NextResponse.json({
    data: requests.map((request) => {
      const primary = request.applicants[0]?.fullName ?? "Applicant";
      const extra = request.applicants.length - 1;
      return {
        id: request.id,
        requestCode: request.requestCode,
        status: request.status,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        bankName: request.bank.name,
        applicantLabel: extra > 0 ? `${primary} +${extra}` : primary,
        documents: request.documents,
      };
    }),
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "BANK_OFFICIAL" || !user.bankId) {
    return NextResponse.json({ error: "Only a bank official can submit a request." }, { status: 403 });
  }
  const parsed = createRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400 });
  }
  const types = new Set(parsed.data.documents.map((item) => item.documentType));
  if (types.size !== 7) {
    return NextResponse.json({ error: "Attach each of the seven documents once." }, { status: 400 });
  }
  try {
    for (const document of parsed.data.documents) {
      if (!ownsKey(user.id, document.fileKey)) {
        return NextResponse.json({ error: "One of the uploads does not belong to this session." }, { status: 400 });
      }
      await assertStoredObject(document.fileKey, MAX_FILE_BYTES);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "A document upload could not be confirmed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const requestCode = await nextRequestCode();
  const created = await prisma.loanRequest.create({
    data: {
      requestCode,
      bankId: user.bankId,
      createdById: user.id,
      status: "PENDING_AT_VENDOR",
      applicantCount: parsed.data.applicants.length,
      applicants: {
        create: parsed.data.applicants.map((applicant, index) => ({
          sequenceNo: index + 1,
          ...applicant,
        })),
      },
      documents: {
        create: parsed.data.documents.map((document) => ({
          documentType: document.documentType as DocumentType,
          fileUrl: document.fileKey,
          fileName: document.fileName,
          fileSizeKb: document.fileSizeKb,
          uploadedById: user.id,
          uploadedByRole: user.role,
          version: 1,
        })),
      },
      statusHistory: {
        create: {
          fromStatus: null,
          toStatus: "PENDING_AT_VENDOR",
          changedById: user.id,
          changedByRole: user.role,
          note: "Request submitted",
        },
      },
    },
  });
  await notifyStatusChange({ requestCode, toStatus: "PENDING_AT_VENDOR" });
  return NextResponse.json({ id: created.id, requestCode });
}
