-- CreateTable
CREATE TABLE "GuruSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "service" TEXT,
    "state" JSONB NOT NULL,
    "questionsAnswered" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuruSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuruSession_userId_updatedAt_idx" ON "GuruSession"("userId", "updatedAt");

