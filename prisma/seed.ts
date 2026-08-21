import "dotenv/config";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";
import { PHASE_1_SERVICES } from "./seed-services";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@shreeguruastro.com";
  const password = process.env.ADMIN_PASSWORD ?? "admin12345";

  const passwordHash = await hashPassword(password);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Admin",
      role: "ADMIN",
      passwordHash,
    },
  });

  console.log(`Admin user ready: ${admin.email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`(using default dev password: ${password})`);
  }

  for (const service of PHASE_1_SERVICES) {
    await prisma.service.upsert({
      where: { slug: service.slug },
      update: {
        name: service.name,
        description: service.description,
        category: service.category,
        intakeSchema: service.intakeSchema as unknown as Prisma.InputJsonValue,
        supportedModes: service.supportedModes,
        phase: 1,
        isActive: true,
      },
      create: {
        slug: service.slug,
        name: service.name,
        description: service.description,
        category: service.category,
        intakeSchema: service.intakeSchema as unknown as Prisma.InputJsonValue,
        supportedModes: service.supportedModes,
        phase: 1,
        isActive: true,
      },
    });
  }
  console.log(`Seeded ${PHASE_1_SERVICES.length} Phase 1 services.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
