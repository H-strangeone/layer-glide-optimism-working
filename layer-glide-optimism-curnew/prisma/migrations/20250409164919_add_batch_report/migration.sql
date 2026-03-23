-- CreateTable
CREATE TABLE "BatchReport" (
    "id" TEXT NOT NULL,
    "batchId" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchReport_pkey" PRIMARY KEY ("id")
);
