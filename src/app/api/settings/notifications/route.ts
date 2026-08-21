import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const emailNotificationsEnabled = !!body?.emailNotificationsEnabled;
  const smsNotificationsEnabled = !!body?.smsNotificationsEnabled;

  if (smsNotificationsEnabled && !phone) {
    return NextResponse.json(
      { error: "Add a phone number to enable SMS notifications." },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      phone: phone || null,
      emailNotificationsEnabled,
      smsNotificationsEnabled,
    },
  });

  return NextResponse.json({ ok: true });
}
