"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getPusherClient } from "@/lib/chat/pusherClient";

interface ChatMessageItem {
  id: string;
  senderId: string;
  body: string;
  sentAt: string;
}

export function ChatPanel({
  bookingId,
  windowStart,
  windowEnd,
  currentUserId,
}: {
  bookingId: string;
  windowStart: string;
  windowEnd: string;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch(`/api/bookings/${bookingId}/messages`)
      .then((response) => (response.ok ? response.json() : { messages: [] }))
      .then((body) => setMessages(body.messages))
      .finally(() => setLoaded(true));
  }, [bookingId]);

  useEffect(() => {
    const pusher = getPusherClient();
    const channelName = `private-booking-${bookingId}`;
    const channel = pusher.subscribe(channelName);
    channel.bind("new-message", (message: ChatMessageItem) => {
      setMessages((current) =>
        current.some((item) => item.id === message.id) ? current : [...current, message],
      );
    });
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [bookingId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const isOpen = now >= new Date(windowStart) && now <= new Date(windowEnd);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError(null);

    const response = await fetch(`/api/bookings/${bookingId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft.trim() }),
    });

    setSending(false);
    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      setError(responseBody?.error ?? "Failed to send message.");
      return;
    }

    setMessages((current) =>
      current.some((item) => item.id === responseBody.message.id)
        ? current
        : [...current, responseBody.message],
    );
    setDraft("");
  }

  if (!isOpen && now < new Date(windowStart)) {
    return (
      <div className="rounded-lg border border-border bg-background-elevated p-3 text-sm text-foreground-muted">
        Chat opens at{" "}
        {new Date(windowStart).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
        .
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!isOpen && <p className="text-sm text-foreground-muted">This chat session has ended.</p>}
      <div
        ref={scrollRef}
        className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-background-elevated p-3"
      >
        {!loaded && <p className="text-sm text-foreground-muted">Loading messages…</p>}
        {loaded && messages.length === 0 && (
          <p className="text-sm text-foreground-muted">No messages yet. Say hello!</p>
        )}
        {messages.map((message) => {
          const isMine = message.senderId === currentUserId;
          return (
            <div key={message.id} className={cn("flex flex-col", isMine ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-3 py-1.5 text-sm",
                  isMine
                    ? "bg-primary text-black"
                    : "border border-border bg-background-surface text-foreground",
                )}
              >
                {message.body}
              </div>
              <span className="mt-0.5 text-[10px] text-foreground-muted">
                {new Date(message.sentAt).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
      </div>
      {isOpen && (
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button type="submit" size="sm" disabled={sending || !draft.trim()}>
            Send
          </Button>
        </form>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
