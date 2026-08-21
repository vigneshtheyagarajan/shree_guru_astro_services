import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_PATTERN = /^\d{9,18}$/;

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user.role !== "ASTROLOGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const accountHolderName =
    typeof body?.accountHolderName === "string" ? body.accountHolderName.trim() : "";
  const accountNumber =
    typeof body?.accountNumber === "string" ? body.accountNumber.trim() : "";
  const ifscCode = typeof body?.ifscCode === "string" ? body.ifscCode.trim().toUpperCase() : "";

  if (!accountHolderName) {
    return NextResponse.json({ error: "Account holder name is required." }, { status: 400 });
  }
  if (!ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
    return NextResponse.json({ error: "Enter a valid account number." }, { status: 400 });
  }
  if (!IFSC_PATTERN.test(ifscCode)) {
    return NextResponse.json({ error: "Enter a valid IFSC code." }, { status: 400 });
  }

  const profile = await prisma.astrologerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) {
    return NextResponse.json({ error: "Astrologer profile not found." }, { status: 404 });
  }

  const detailsChanged =
    profile.payoutAccountHolderName !== accountHolderName ||
    profile.payoutAccountNumber !== accountNumber ||
    profile.payoutIfscCode !== ifscCode;

  await prisma.astrologerProfile.update({
    where: { id: profile.id },
    data: {
      payoutAccountHolderName: accountHolderName,
      payoutAccountNumber: accountNumber,
      payoutIfscCode: ifscCode,
      // Bank details changed -- force re-registering the fund account with Razorpay.
      ...(detailsChanged ? { razorpayContactId: null, razorpayFundAccountId: null } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
