-- CreateTable
CREATE TABLE "Operator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "bondWei" TEXT NOT NULL DEFAULT '0',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContractDeployment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "chainId" TEXT NOT NULL DEFAULT '1337',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "onChainId" TEXT,
    "stateRoot" TEXT,
    "prevStateRoot" TEXT,
    "txRoot" TEXT,
    "transactionsRoot" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending_submission',
    "submitter" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "challengeEndsAt" DATETIME,
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "onChainTxHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PendingTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "valueWei" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL DEFAULT 0,
    "signature" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "batchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PendingTransaction_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "challengerAddress" TEXT NOT NULL,
    "fraudProofHash" TEXT NOT NULL,
    "merkleProof" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rewardWei" TEXT,
    "resolvedAt" DATETIME,
    "onChainTxHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Challenge_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Layer2Balance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAddress" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "balanceWei" TEXT NOT NULL DEFAULT '0',
    "pendingBalanceWei" TEXT NOT NULL DEFAULT '0',
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StateSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "stateRoot" TEXT NOT NULL,
    "prevStateRoot" TEXT NOT NULL,
    "entriesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StateSnapshot_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Balance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "layer1BalanceWei" TEXT NOT NULL DEFAULT '0',
    "layer2BalanceWei" TEXT NOT NULL DEFAULT '0',
    "pendingWei" TEXT NOT NULL DEFAULT '0',
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Nonce" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAddress" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "currentNonce" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "GasAnalytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchOnChainId" TEXT NOT NULL,
    "txCount" INTEGER NOT NULL,
    "actualGasWei" TEXT NOT NULL,
    "estimatedL1GasWei" TEXT NOT NULL,
    "savedGasWei" TEXT NOT NULL,
    "gasPrice" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "stateRoot" TEXT NOT NULL,
    "proofJson" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "onChainId" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "Operator_address_key" ON "Operator"("address");

-- CreateIndex
CREATE UNIQUE INDEX "ContractDeployment_address_key" ON "ContractDeployment"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_onChainId_key" ON "Batch"("onChainId");

-- CreateIndex
CREATE INDEX "Batch_status_idx" ON "Batch"("status");

-- CreateIndex
CREATE INDEX "Batch_onChainId_idx" ON "Batch"("onChainId");

-- CreateIndex
CREATE INDEX "Batch_stateRoot_idx" ON "Batch"("stateRoot");

-- CreateIndex
CREATE INDEX "PendingTransaction_fromAddress_idx" ON "PendingTransaction"("fromAddress");

-- CreateIndex
CREATE INDEX "PendingTransaction_toAddress_idx" ON "PendingTransaction"("toAddress");

-- CreateIndex
CREATE INDEX "PendingTransaction_batchId_idx" ON "PendingTransaction"("batchId");

-- CreateIndex
CREATE INDEX "PendingTransaction_status_idx" ON "PendingTransaction"("status");

-- CreateIndex
CREATE INDEX "Challenge_batchId_idx" ON "Challenge"("batchId");

-- CreateIndex
CREATE INDEX "Challenge_status_idx" ON "Challenge"("status");

-- CreateIndex
CREATE INDEX "Layer2Balance_userAddress_idx" ON "Layer2Balance"("userAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Layer2Balance_userAddress_contractAddress_key" ON "Layer2Balance"("userAddress", "contractAddress");

-- CreateIndex
CREATE UNIQUE INDEX "StateSnapshot_batchId_key" ON "StateSnapshot"("batchId");

-- CreateIndex
CREATE INDEX "StateSnapshot_stateRoot_idx" ON "StateSnapshot"("stateRoot");

-- CreateIndex
CREATE UNIQUE INDEX "Balance_address_key" ON "Balance"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Nonce_userAddress_contractAddress_key" ON "Nonce"("userAddress", "contractAddress");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_userAddress_idx" ON "WithdrawalRequest"("userAddress");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_processed_idx" ON "WithdrawalRequest"("processed");
