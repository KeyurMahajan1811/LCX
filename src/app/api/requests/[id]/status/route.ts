import { NextResponse } from "next/server";
import { loadRequest } from "@/lib/access";
import { notifyStatusChange } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { statusSchema } from "@/lib/validators";
import { resolveTransition } from "@/lib/workflow";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const existing = await loadRequest(user, id);
  if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid action." }, { status: 400 });
  const next = resolveTransition(user.role, existing.status, parsed.data.intent);
  if (!next) return NextResponse.json({ error: "That status change is not allowed." }, { status: 403 });
  if (parsed.data.intent === "complete" && !existing.documents.some((document) => document.documentType === "FINAL_CHALLAN")) {
    return NextResponse.json({ error: "Upload the final challan before completing the request." }, { status: 400 });
  }
  if (parsed.data.intent === "advance" && !parsed.data.note) {
    return NextResponse.json({ error: "Add a note for the other party." }, { status: 400 });
  }
  await prisma.$transaction([
    prisma.loanRequest.update({ where: { id: existing.id }, data: { status: next } }),
    prisma.statusHistory.create({
      data: {
        requestId: existing.id,
        fromStatus: existing.status,
        toStatus: next,
        changedById: user.id,
        changedByRole: user.role,
        note: parsed.data.note || (parsed.data.intent === "complete" ? "Final challan uploaded" : null),
      },
    }),
  ]);
  await notifyStatusChange({ requestCode: existing.requestCode, toStatus: next });
  return NextResponse.json({ status: next });
}
