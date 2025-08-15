/*
  Warnings:

  - You are about to drop the column `walletAddress` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `walletId` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "walletAddress",
DROP COLUMN "walletId",
ADD COLUMN     "evmWalletAddress" TEXT,
ADD COLUMN     "evmWalletId" TEXT,
ADD COLUMN     "solanaWalletAddress" TEXT,
ADD COLUMN     "solanaWalletId" TEXT;
