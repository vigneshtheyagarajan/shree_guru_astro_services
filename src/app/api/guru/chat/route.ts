import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { GuruInputError } from "@/lib/guru/astro/time";
import { GuruAccessError, handleTurn } from "@/lib/guru/conversation";
import { createGuruDeps, guruEnabled } from "@/lib/guru/server";

// One Guru turn can run several model calls and tool rounds.
export const maxDuration = 120;

export async function POST(request: Request) {
  // Off unless explicitly enabled: the route does not exist as far as callers can tell.
  if (!guruEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in to talk to Guru." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { sessionId?: unknown; message?: unknown } | null;
  if (typeof body?.message !== "string" || !body.message.trim()) {
    return NextResponse.json({ error: "Please type a message." }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : undefined;

  try {
    const reply = await handleTurn(
      { sessionId, userId: session.user.id, text: body.message, signal: request.signal },
      createGuruDeps(session.user.id),
    );
    return NextResponse.json({
      sessionId: reply.sessionId,
      reply: reply.text,
      decision: reply.decision,
      service: reply.service,
      answered: reply.answered,
      chargedRupees: reply.chargedRupees,
      balance: reply.balance,
    });
  } catch (error) {
    if (error instanceof GuruInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof GuruAccessError) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    console.error("[guru] chat route failed", error);
    return NextResponse.json({ error: "Guru is unavailable right now. Please try again." }, { status: 502 });
  }
}
