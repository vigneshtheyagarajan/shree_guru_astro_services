-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "reminder10minSentAt" TIMESTAMP(3),
ADD COLUMN     "reminder1hrSentAt" TIMESTAMP(3),
ADD COLUMN     "sessionStartingSentAt" TIMESTAMP(3);
