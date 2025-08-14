-- CreateTable
CREATE TABLE "public"."FundingIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceChain" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" DECIMAL(38,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingIntent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."FundingIntent" ADD CONSTRAINT "FundingIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
