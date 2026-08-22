import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { PlatformSettingsForm } from "@/components/admin/PlatformSettingsForm";
import { getPlatformSettings } from "@/lib/platformSettings";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/settings");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const settings = await getPlatformSettings();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Platform Settings</h1>
        <p className="text-sm text-foreground-muted">Platform-wide configuration.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Commission</CardTitle>
        </CardHeader>
        <CardContent>
          <PlatformSettingsForm initialDefaultCommissionPercent={settings.defaultCommissionPercent} />
        </CardContent>
      </Card>
    </main>
  );
}
