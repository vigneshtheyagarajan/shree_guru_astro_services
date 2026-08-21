import PusherClient from "pusher-js";

let client: PusherClient | null = null;

export function getPusherClient() {
  if (!client) {
    client = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY as string, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER as string,
      authEndpoint: "/api/chat/auth",
    });
  }
  return client;
}
