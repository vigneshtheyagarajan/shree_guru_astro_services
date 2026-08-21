import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvailabilityManager } from "@/components/astrologer/AvailabilityManager";

export default async function AstrologerAvailabilityPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/astrologer/availability");
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

  const [rules, exceptions] = await Promise.all([
    prisma.availabilityRule.findMany({
      where: { astrologerId: profile.id },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.availabilityException.findMany({
      where: { astrologerId: profile.id },
      orderBy: { date: "asc" },
    }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Availability</h1>
        <p className="text-sm text-foreground-muted">
          Set your weekly hours and block off or add exceptions for specific dates.
          Bookable slots for the next 14 days are generated automatically from this.
        </p>
      </header>

      <AvailabilityManager
        initialRules={rules}
        initialExceptions={exceptions.map((exception) => ({
          ...exception,
          date: exception.date.toISOString(),
        }))}
      />
    </main>
  );
}
