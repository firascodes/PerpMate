import { prisma } from './client';

export async function logFundingIntent(userId: string, sourceChain: 'solana' | 'base', amount: number) {
  return prisma.fundingIntent.create({
    data: {
      userId,
      sourceChain,
      token: 'USDC',
      amount,
      status: 'pending',
    },
  });
}
