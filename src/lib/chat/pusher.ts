import PusherServer from "pusher";

// Server-side client for triggering events (used from API routes).
// Browser-side subscription setup (pusher-js) is added alongside the chat UI.
export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID as string,
  key: process.env.PUSHER_KEY as string,
  secret: process.env.PUSHER_SECRET as string,
  cluster: process.env.PUSHER_CLUSTER as string,
  useTLS: true,
});
