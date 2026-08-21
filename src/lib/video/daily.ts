const DAILY_API_KEY = process.env.DAILY_API_KEY as string;
const BASE_URL = "https://api.daily.co/v1";

async function dailyFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error ?? data?.info ?? `Daily.co request to ${path} failed`;
    throw new Error(message);
  }
  return data;
}

/**
 * Creates a private Daily.co room for a video-call booking, expiring shortly
 * after the session ends so it doesn't linger as a joinable room.
 */
export async function createRoomForBooking(booking: { id: string; endAt: Date }) {
  const room = await dailyFetch("/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: `booking-${booking.id}`,
      privacy: "private",
      properties: {
        exp: Math.floor(booking.endAt.getTime() / 1000) + 15 * 60,
        enable_chat: true,
        enable_screenshare: true,
      },
    }),
  });
  return { roomUrl: room.url as string, roomName: room.name as string };
}

/**
 * Issues a short-lived meeting token scoped to one participant so the room
 * stays private (join requires a valid token, not just the room URL).
 */
export async function createMeetingToken(
  roomName: string,
  userName: string,
  isOwner: boolean,
  expiresAt: Date,
) {
  const result = await dailyFetch("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName,
        is_owner: isOwner,
        exp: Math.floor(expiresAt.getTime() / 1000),
      },
    }),
  });
  return result.token as string;
}
