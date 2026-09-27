import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const banks = await prisma.bank.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return NextResponse.json({ data: banks });
}
