-- CreateEnum
CREATE TYPE "AvailabilityExceptionSource" AS ENUM ('MANUAL', 'GOOGLE');

-- AlterTable
ALTER TABLE "AstrologerProfile" ADD COLUMN     "googleAccessToken" TEXT,
ADD COLUMN     "googleCalendarConnectedAt" TIMESTAMP(3),
ADD COLUMN     "googleRefreshToken" TEXT,
ADD COLUMN     "googleTokenExpiry" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AvailabilityException" ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "source" "AvailabilityExceptionSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "googleEventId" TEXT;

-- AlterTable
ALTER TABLE "IntakeSubmission" ADD COLUMN     "attachmentsHidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "smsNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;
