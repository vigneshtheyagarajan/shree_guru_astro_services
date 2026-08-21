import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { OnlineToggle } from "@/components/astrologer/OnlineToggle";

const STATUS_COPY: Record<string, { variant: "warning" | "success" | "danger"; message: string }> = {
  PENDING: {
    variant: "warning",
    message:
      "Your application is under review. We'll notify you by email once an admin approves your profile.",
  },
  APPROVED: {
    variant: "success",
    message:
      "You're approved! Availability and service setup will appear here as those features are built.",
  },
  REJECTED: {
    variant: "danger",
    message:
      "Your application wasn't approved. Contact support if you think this is a mistake.",
  },
  SUSPENDED: {
    variant: "danger",
    message: "Your account has been suspended. Contact support for more information.",
  },
};

export default async function AstrologerDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/astrologer/dashboard");
  }
  if (session.user.role !== "ASTROLOGER") {
    redirect("/");
  }

  const profile = await prisma.astrologerProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    redirect("/apply-astrologer");
  }

  const status = STATUS_COPY[profile.approvalStatus];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Astrologer Dashboard</CardTitle>
          <Badge variant={status.variant}>{profile.approvalStatus}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-foreground-muted">{status.message}</p>
          {profile.approvalStatus === "APPROVED" && (
            <OnlineToggle initialOnline={profile.isOnline} />
          )}
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-foreground-muted">Languages</dt>
              <dd className="text-foreground">{profile.languages.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-foreground-muted">Experience</dt>
              <dd className="text-foreground">
                {profile.experienceYears != null
                  ? `${profile.experienceYears} yrs`
                  : "—"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-foreground-muted">Bio</dt>
              <dd className="text-foreground">{profile.bio || "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </main>
  );
}
