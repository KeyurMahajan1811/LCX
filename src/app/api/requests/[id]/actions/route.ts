import { NextResponse } from "next/server";
import { loadRequest } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { actionSchema } from "@/lib/validators";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const existing = await loadRequest(user, id);
  if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    return NextResponse.json({ error: "This request is closed." }, { status: 409 });
  }
  const waitingOn =
    (user.role === "VENDOR" && existing.status === "PENDING_AT_VENDOR") ||
    (user.role === "BANK_OFFICIAL" && existing.status === "PENDING_AT_BANK");
  if (!waitingOn) return NextResponse.json({ error: "It is not your turn to write on this request." }, { status: 403 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Write a message." }, { status: 400 });
  }
  const message = await prisma.actionMessage.create({
    data: { requestId: existing.id, fromRole: user.role, message: parsed.data.message },
  });
  return NextResponse.json({ id: message.id });
}
