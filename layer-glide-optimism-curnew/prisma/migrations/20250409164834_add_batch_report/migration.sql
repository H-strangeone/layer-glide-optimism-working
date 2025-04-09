/*
  Warnings:

  - The primary key for the `Batch` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Batch` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `BatchChallenge` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `BatchChallenge` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `BatchTransaction` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `BatchTransaction` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "BatchChallenge" DROP CONSTRAINT "BatchChallenge_batchId_fkey";

-- DropForeignKey
ALTER TABLE "BatchTransaction" DROP CONSTRAINT "BatchTransaction_batchId_fkey";

-- AlterTable
ALTER TABLE "Batch" DROP CONSTRAINT "Batch_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" BIGSERIAL NOT NULL,
ADD CONSTRAINT "Batch_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "BatchChallenge" DROP CONSTRAINT "BatchChallenge_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" BIGSERIAL NOT NULL,
ADD CONSTRAINT "BatchChallenge_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "BatchTransaction" DROP CONSTRAINT "BatchTransaction_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" BIGSERIAL NOT NULL,
ADD CONSTRAINT "BatchTransaction_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "BatchTransaction" ADD CONSTRAINT "BatchTransaction_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchChallenge" ADD CONSTRAINT "BatchChallenge_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
