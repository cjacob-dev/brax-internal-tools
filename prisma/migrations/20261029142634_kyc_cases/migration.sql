-- CreateTable
CREATE TABLE "KycCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerName" TEXT NOT NULL,
    "customerType" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskTier" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "documents" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "claimedBy" TEXT,
    "recommendedBy" TEXT,
    "recommendation" TEXT,
    "recommendationReason" TEXT,
    "escalationNote" TEXT,
    "decidedBy" TEXT,
    "decisionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slaDueAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "KycCase_status_idx" ON "KycCase"("status");

-- CreateIndex
CREATE INDEX "KycCase_riskTier_idx" ON "KycCase"("riskTier");

-- CreateIndex
CREATE INDEX "KycCase_slaDueAt_idx" ON "KycCase"("slaDueAt");
