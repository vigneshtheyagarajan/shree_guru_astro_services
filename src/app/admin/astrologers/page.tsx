import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { AstrologerStatusActions } from "@/components/admin/AstrologerStatusActions";
import { CommissionOverrideForm } from "@/components/admin/CommissionOverrideForm";
import { getPlatformSettings } from "@/lib/platformSettings";

const BADGE_VARIANT = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  SUSPENDED: "danger",
} as const;

export default async function AdminAstrologersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/astrologers");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const [profiles, platformSettings] = await Promise.all([
    prisma.astrologerProfile.findMany({
      include: { user: true },
      orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }],
    }),
    getPlatformSettings(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Astrologer Applications</h1>
        <p className="text-sm text-foreground-muted">
          Approve, reject, or suspend astrologer profiles.
        </p>
      </header>

      {profiles.length === 0 && (
        <p className="text-sm text-foreground-muted">No astrologer applications yet.</p>
      )}

      <div className="flex flex-col gap-4">
        {profiles.map((profile) => (
          <Card key={profile.id}>
            <CardHeader className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 break-words">
                <CardTitle>{profile.user.name}</CardTitle>
                <p className="text-sm text-foreground-muted">{profile.user.email}</p>
                {profile.user.phone && (
                  <p className="text-sm text-foreground-muted">{profile.user.phone}</p>
                )}
              </div>
              <Badge variant={BADGE_VARIANT[profile.approvalStatus]}>
                {profile.approvalStatus}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
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
              <CommissionOverrideForm
                astrologerId={profile.id}
                initialCommissionPercent={profile.commissionPercent}
                defaultCommissionPercent={platformSettings.defaultCommissionPercent}
              />
              <AstrologerStatusActions
                astrologerId={profile.id}
                currentStatus={profile.approvalStatus}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
