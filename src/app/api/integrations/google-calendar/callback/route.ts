import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens } from "@/lib/integrations/googleCalendar";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const redirectTo = new URL("/astrologer/availability", url.origin);

  if (oauthError) {
    redirectTo.searchParams.set("google", "error");
    return NextResponse.redirect(redirectTo);
  }

  const session = await auth();
  if (session?.user.role !== "ASTROLOGER" || !code || !state) {
    redirectTo.searchParams.set("google", "error");
    return NextResponse.redirect(redirectTo);
  }

  const profile = await prisma.astrologerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile || profile.id !== state) {
    redirectTo.searchParams.set("google", "error");
    return NextResponse.redirect(redirectTo);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await prisma.astrologerProfile.update({
      where: { id: profile.id },
      data: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token ?? profile.googleRefreshToken,
        googleTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        googleCalendarConnectedAt: new Date(),
      },
    });
    redirectTo.searchParams.set("google", "connected");
  } catch (error) {
    console.error("Failed to connect Google Calendar", error);
    redirectTo.searchParams.set("google", "error");
  }

  return NextResponse.redirect(redirectTo);
}
