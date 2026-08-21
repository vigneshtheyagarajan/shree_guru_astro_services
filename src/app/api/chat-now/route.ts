import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requestChatNow, ChatNowError } from "@/lib/chat/chatQueue";

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Only clients can start an instant chat." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const serviceOfferingId =
    typeof body?.serviceOfferingId === "string" ? body.serviceOfferingId : "";
  if (!serviceOfferingId) {
    return NextResponse.json({ error: "Missing serviceOfferingId." }, { status: 400 });
  }

  try {
    const result = await requestChatNow(session.user.id, serviceOfferingId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ChatNowError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
