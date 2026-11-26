ALTER TABLE "BrainInstance" ADD COLUMN "leaseToken" TEXT,
ADD COLUMN "leaseUntil" TIMESTAMP(3),
ADD COLUMN "endpointPort" INTEGER,
ADD COLUMN "encryptedMcpToken" TEXT,
ADD COLUMN "lastError" TEXT;
CREATE INDEX "BrainInstance_status_leaseUntil_idx" ON "BrainInstance"("status", "leaseUntil");
