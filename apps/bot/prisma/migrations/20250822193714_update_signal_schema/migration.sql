/*
  Warnings:

  - You are about to drop the column `entry` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `explanation` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `features` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `leverage` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `notionalUsd` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `score` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `side` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `sl` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `timeframe` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `tp` on the `Signal` table. All the data in the column will be lost.
  - Added the required column `action` to the `Signal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `confidence` to the `Signal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fundingRate` to the `Signal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reasoning` to the `Signal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rsi` to the `Signal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `volumeRatio` to the `Signal` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Signal" DROP COLUMN "entry",
DROP COLUMN "explanation",
DROP COLUMN "features",
DROP COLUMN "leverage",
DROP COLUMN "notionalUsd",
DROP COLUMN "score",
DROP COLUMN "side",
DROP COLUMN "sl",
DROP COLUMN "timeframe",
DROP COLUMN "tp",
ADD COLUMN     "action" TEXT NOT NULL,
ADD COLUMN     "broadcastTo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "confidence" INTEGER NOT NULL,
ADD COLUMN     "fundingRate" DECIMAL(8,4) NOT NULL,
ADD COLUMN     "reasoning" JSONB NOT NULL,
ADD COLUMN     "rsi" DECIMAL(5,2) NOT NULL,
ADD COLUMN     "volumeRatio" DECIMAL(5,2) NOT NULL;
