import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { payBookingFromWallet, WalletError } from "@/lib/wallet";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await payBookingFromWallet(id, session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof WalletError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
