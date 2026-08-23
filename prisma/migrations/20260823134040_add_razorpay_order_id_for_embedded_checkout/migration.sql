-- AlterTable
ALTER TABLE "PaymentLink" ADD COLUMN     "razorpayOrderId" TEXT,
ALTER COLUMN "razorpayLinkId" DROP NOT NULL,
ALTER COLUMN "shortUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WalletTopUp" ADD COLUMN     "razorpayOrderId" TEXT,
ALTER COLUMN "razorpayLinkId" DROP NOT NULL,
ALTER COLUMN "shortUrl" DROP NOT NULL;
