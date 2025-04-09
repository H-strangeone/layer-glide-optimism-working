/*
  Warnings:

  - Changed the type of `batchId` on the `Batch` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `batchId` on the `BatchChallenge` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `batchId` on the `BatchTransaction` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "BatchChallenge" DROP CONSTRAINT "BatchChallenge_batchId_fkey";

-- DropForeignKey
ALTER TABLE "BatchTransaction" DROP CONSTRAINT "BatchTransaction_batchId_fkey";

-- AlterTable
ALTER TABLE "Batch" DROP COLUMN "batchId",
ADD COLUMN     "batchId" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "BatchChallenge" DROP COLUMN "batchId",
ADD COLUMN     "batchId" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "BatchTransaction" DROP COLUMN "batchId",
ADD COLUMN     "batchId" BIGINT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Batch_batchId_key" ON "Batch"("batchId");

-- AddForeignKey
ALTER TABLE "BatchTransaction" ADD CONSTRAINT "BatchTransaction_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("batchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchChallenge" ADD CONSTRAINT "BatchChallenge_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("batchId") ON DELETE RESTRICT ON UPDATE CASCADE;
