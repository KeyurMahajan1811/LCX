import { NextResponse } from "next/server";
import { loadRequest } from "@/lib/access";
import { currentUser } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const request = await loadRequest(user, id);
  if (!request) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  return NextResponse.json({
    data: {
      id: request.id,
      requestCode: request.requestCode,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      bankName: request.bank.name,
      createdBy: request.createdBy.name,
      applicants: request.applicants.map((applicant) => ({
        sequenceNo: applicant.sequenceNo,
        fullName: applicant.fullName,
        panCard: applicant.panCard,
        aadhaarCard: applicant.aadhaarCard,
        mobileNo: applicant.mobileNo,
        email: applicant.email,
      })),
      documents: request.documents.map((document) => ({
        id: document.id,
        documentType: document.documentType,
        fileName: document.fileName,
        fileSizeKb: document.fileSizeKb,
        version: document.version,
        uploadedByRole: document.uploadedByRole,
        uploadedAt: document.uploadedAt,
      })),
      statusHistory: request.statusHistory,
      actions: request.actions,
    },
  });
}
