import { NextResponse } from "next/server";
import { loadRequest } from "@/lib/access";
import { presignDownload } from "@/lib/s3";
import { currentUser } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string; docId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id, docId } = await context.params;
  const request = await loadRequest(user, id);
  if (!request) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  const document = request.documents.find((item) => item.id === docId);
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const url = await presignDownload(document.fileUrl);
  return NextResponse.json({ url, fileName: document.fileName });
}
