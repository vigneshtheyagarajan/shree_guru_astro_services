import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ServiceOfferingForm } from "@/components/astrologer/ServiceOfferingForm";

export default async function AstrologerServicesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/astrologer/services");
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

  const [services, offerings] = await Promise.all([
    prisma.service.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.serviceOffering.findMany({ where: { astrologerId: profile.id } }),
  ]);

  const offeringByServiceId = new Map(offerings.map((offering) => [offering.serviceId, offering]));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Your Services</h1>
        <p className="text-sm text-foreground-muted">
          Set your price, session duration, and consultation modes for each service you offer.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {services.map((service) => {
          const offering = offeringByServiceId.get(service.id) ?? null;
          return (
            <Card key={service.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{service.name}</CardTitle>
                  <p className="text-sm text-foreground-muted">{service.description}</p>
                </div>
                <Badge variant={offering ? "success" : "default"}>
                  {offering ? "Offering" : "Not offering"}
                </Badge>
              </CardHeader>
              <CardContent>
                <ServiceOfferingForm
                  serviceId={service.id}
                  supportedModes={service.supportedModes}
                  existingOffering={
                    offering
                      ? {
                          pricePerSession: offering.pricePerSession,
                          durationMinutes: offering.durationMinutes,
                          modes: offering.modes,
                        }
                      : null
                  }
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
