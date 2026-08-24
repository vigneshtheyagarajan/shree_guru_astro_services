-- AlterEnum
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'PAID', 'RATED', 'CANCELLED', 'NO_SHOW');
ALTER TABLE "public"."Booking" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "public"."BookingStatus_old";
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ConsultationMode_new" AS ENUM ('CHAT', 'CALL');
ALTER TABLE "Service" ALTER COLUMN "supportedModes" TYPE "ConsultationMode_new"[] USING ("supportedModes"::text::"ConsultationMode_new"[]);
ALTER TABLE "ServiceOffering" ALTER COLUMN "modes" TYPE "ConsultationMode_new"[] USING ("modes"::text::"ConsultationMode_new"[]);
ALTER TABLE "Booking" ALTER COLUMN "mode" TYPE "ConsultationMode_new" USING ("mode"::text::"ConsultationMode_new");
ALTER TYPE "ConsultationMode" RENAME TO "ConsultationMode_old";
ALTER TYPE "ConsultationMode_new" RENAME TO "ConsultationMode";
DROP TYPE "public"."ConsultationMode_old";
COMMIT;

-- AlterTable
ALTER TABLE "AstrologerProfile" DROP COLUMN "address";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "addressRevealedAt",
DROP COLUMN "clientPhone",
DROP COLUMN "dailyRoomName",
DROP COLUMN "dailyRoomUrl";

-- CreateTable
CREATE TABLE "CallRecording" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "cloudinaryUrl" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallRecording_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CallRecording" ADD CONSTRAINT "CallRecording_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecording" ADD CONSTRAINT "CallRecording_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

