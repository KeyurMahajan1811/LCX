import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

export async function loadRequest(user: SessionUser, id: string) {
  const request = await prisma.loanRequest.findUnique({
    where: { id },
    include: {
      bank: true,
      createdBy: { select: { id: true, name: true, role: true } },
      applicants: { orderBy: { sequenceNo: "asc" } },
      documents: { orderBy: [{ documentType: "asc" }, { version: "desc" }] },
      statusHistory: { orderBy: { changedAt: "asc" } },
      actions: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!request) return null;
  if (user.role === "BANK_OFFICIAL" && request.bankId !== user.bankId) return null;
  return request;
}

export async function nextRequestCode() {
  const year = new Date().getFullYear();
  const prefix = `LCX-${year}-`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const latest = await prisma.loanRequest.findFirst({
      where: { requestCode: { startsWith: prefix } },
      orderBy: { requestCode: "desc" },
      select: { requestCode: true },
    });
    const current = latest ? Number(latest.requestCode.slice(prefix.length)) : 0;
    const code = `${prefix}${String(current + 1 + attempt).padStart(5, "0")}`;
    const exists = await prisma.loanRequest.findUnique({ where: { requestCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("Could not allocate a request code.");
}
