import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardContent } from "@/components/ui";
import { formatDateTimeShort } from "@/lib/dateFormat";

export default async function AdminNotificationsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/notifications");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const notifications = await prisma.notification.findMany({
    include: { user: true },
    orderBy: { sentAt: "desc" },
    take: 100,
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Notification Log</h1>
        <p className="text-sm text-foreground-muted">
          Most recent 100 notifications sent, across all channels.
        </p>
      </header>

      {notifications.length === 0 ? (
        <p className="text-sm text-foreground-muted">No notifications sent yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((notification) => {
            const payload = notification.payload as { title?: string; message?: string };
            return (
              <Card key={notification.id}>
                <CardContent className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="primary">{notification.event.replace(/_/g, " ")}</Badge>
                      <Badge variant="default">{notification.channel}</Badge>
                      {notification.readAt && <Badge variant="success">Read</Badge>}
                    </div>
                    <p className="mt-1 truncate text-sm text-foreground">
                      {payload.title} — {payload.message}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {notification.user.name} ({notification.user.email})
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-foreground-muted">
                    {formatDateTimeShort(notification.sentAt)}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
