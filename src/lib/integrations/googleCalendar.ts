import { prisma } from "@/lib/prisma";
import type { AstrologerProfile } from "@/generated/prisma/client";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET as string;
const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI as string;
const CALENDAR_ID = "primary";

export function isGoogleCalendarConnected(profile: AstrologerProfile) {
  return !!profile.googleRefreshToken;
}

export function getGoogleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/calendar",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error_description ?? body?.error ?? "Failed to exchange code.");
  }
  return body;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error_description ?? body?.error ?? "Failed to refresh token.");
  }
  return body;
}

/** Returns a valid access token for this astrologer, refreshing it if expired. */
export async function getValidAccessToken(profile: AstrologerProfile): Promise<string | null> {
  if (!profile.googleRefreshToken) return null;

  const isExpired = !profile.googleTokenExpiry || profile.googleTokenExpiry <= new Date();
  if (!isExpired && profile.googleAccessToken) {
    return profile.googleAccessToken;
  }

  const tokens = await refreshAccessToken(profile.googleRefreshToken);
  const expiry = new Date(Date.now() + tokens.expires_in * 1000);
  await prisma.astrologerProfile.update({
    where: { id: profile.id },
    data: { googleAccessToken: tokens.access_token, googleTokenExpiry: expiry },
  });
  return tokens.access_token;
}

export async function pushBookingEvent(
  profile: AstrologerProfile,
  booking: {
    id: string;
    startAt: Date;
    endAt: Date;
    serviceName: string;
    clientName: string;
    mode: string;
  },
): Promise<string | null> {
  const accessToken = await getValidAccessToken(profile);
  if (!accessToken) return null;

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: `${booking.serviceName} with ${booking.clientName}`,
        description: `Shree Guru Astro Services booking (${booking.mode}). Booking ID: ${booking.id}`,
        start: { dateTime: booking.startAt.toISOString() },
        end: { dateTime: booking.endAt.toISOString() },
      }),
    },
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.message ?? "Failed to create calendar event.");
  }
  return body.id as string;
}

export async function deleteBookingEvent(profile: AstrologerProfile, googleEventId: string) {
  const accessToken = await getValidAccessToken(profile);
  if (!accessToken) return;

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events/${googleEventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Failed to delete calendar event.");
  }
}

export interface BusyBlock {
  start: string;
  end: string;
}

export async function pullBusyTimes(
  profile: AstrologerProfile,
  timeMin: Date,
  timeMax: Date,
): Promise<BusyBlock[]> {
  const accessToken = await getValidAccessToken(profile);
  if (!accessToken) return [];

  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: CALENDAR_ID }],
    }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.message ?? "Failed to fetch free/busy data.");
  }
  return (body.calendars?.[CALENDAR_ID]?.busy ?? []) as BusyBlock[];
}
