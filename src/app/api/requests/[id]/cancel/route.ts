import { NextResponse } from "next/server";
import { loadRequest } from "@/lib/access";
import { notifyStatusChange } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { cancelSchema } from "@/lib/validators";
import { resolveTransition } from "@/lib/workflow";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const existing = await loadRequest(user, id);
  if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  const next = resolveTransition(user.role, existing.status, "cancel");
  if (!next) return NextResponse.json({ error: "This request can no longer be cancelled." }, { status: 409 });
  const parsed = cancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "A reason is required." }, { status: 400 });
  }
  await prisma.$transaction([
    prisma.loanRequest.update({ where: { id: existing.id }, data: { status: "CANCELLED" } }),
    prisma.actionMessage.create({
      data: { requestId: existing.id, fromRole: user.role, message: parsed.data.reason },
    }),
    prisma.statusHistory.create({
      data: {
        requestId: existing.id,
        fromStatus: existing.status,
        toStatus: "CANCELLED",
        changedById: user.id,
        changedByRole: user.role,
        note: parsed.data.reason,
      },
    }),
  ]);
  await notifyStatusChange({ requestCode: existing.requestCode, toStatus: "CANCELLED" });
  return NextResponse.json({ status: "CANCELLED" });
}
