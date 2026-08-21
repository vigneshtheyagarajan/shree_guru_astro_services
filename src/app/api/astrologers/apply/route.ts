import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const bio = typeof body?.bio === "string" ? body.bio.trim() : "";
  const languages: string[] = Array.isArray(body?.languages)
    ? body.languages.filter((lang: unknown) => typeof lang === "string" && lang.trim())
    : [];
  const experienceYears =
    typeof body?.experienceYears === "number" && Number.isFinite(body.experienceYears)
      ? Math.max(0, Math.trunc(body.experienceYears))
      : null;

  if (!name || !EMAIL_RE.test(email) || password.length < 8) {
    return NextResponse.json(
      { error: "Provide a name, valid email, and a password of at least 8 characters." },
      { status: 400 },
    );
  }
  if (!bio || languages.length === 0) {
    return NextResponse.json(
      { error: "Provide a short bio and at least one language you consult in." },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      passwordHash,
      role: "ASTROLOGER",
      astrologerProfile: {
        create: {
          bio,
          languages,
          experienceYears,
          approvalStatus: "PENDING",
        },
      },
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
