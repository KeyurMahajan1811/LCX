import { NextResponse } from "next/server";
import { presignUpload } from "@/lib/s3";
import { currentUser } from "@/lib/session";
import { presignSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const parsed = presignSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the file name, type, and size." }, { status: 400 });
  try {
    const signed = await presignUpload({ userId: user.id, ...parsed.data });
    return NextResponse.json(signed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare the upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
