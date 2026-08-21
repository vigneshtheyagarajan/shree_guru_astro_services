import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { NotificationSettingsForm } from "@/components/settings/NotificationSettingsForm";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/settings");
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationSettingsForm
            initialPhone={user.phone ?? ""}
            initialEmailEnabled={user.emailNotificationsEnabled}
            initialSmsEnabled={user.smsNotificationsEnabled}
          />
        </CardContent>
      </Card>
    </main>
  );
}
