

-- Create StateSnapshot
CREATE TABLE IF NOT EXISTS "StateSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "balanceWei" TEXT NOT NULL,
    "snapshotType" TEXT NOT NULL DEFAULT 'pre',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StateSnapshot_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "StateSnapshot_batchId_idx" ON "StateSnapshot"("batchId");
CREATE INDEX IF NOT EXISTS "StateSnapshot_userAddress_idx" ON "StateSnapshot"("userAddress");

-- Create WithdrawalRequest
CREATE TABLE IF NOT EXISTS "WithdrawalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT,
    "userAddress" TEXT NOT NULL,
    "amountWei" TEXT NOT NULL,
    "withdrawalNonce" INTEGER NOT NULL,
    "merkleProof" TEXT NOT NULL,
    "withdrawalRoot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "onChainTxHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WithdrawalRequest_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "WithdrawalRequest_userAddress_idx" ON "WithdrawalRequest"("userAddress");
CREATE INDEX IF NOT EXISTS "WithdrawalRequest_status_idx" ON "WithdrawalRequest"("status");