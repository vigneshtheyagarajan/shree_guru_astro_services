import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const attachmentsHidden = !!body?.attachmentsHidden;

  const submission = await prisma.intakeSubmission.findUnique({ where: { id } });
  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.intakeSubmission.update({ where: { id }, data: { attachmentsHidden } });

  return NextResponse.json({ ok: true });
}
