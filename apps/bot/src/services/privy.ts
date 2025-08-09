import { prisma } from '../db/client';
import { logger } from '../logger';

export type WalletRecord = {
  userId: string;
  walletAddress: string;
  privyUserId?: string | null;
};

export async function getOrCreateUserWallet(telegramId: string): Promise<WalletRecord> {
  // Placeholder: persist a stub record; integrate Privy SDK in next step
  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    user = await prisma.user.create({
      data: { telegramId, walletAddress: null, privyUserId: null },
    });
  }
  if (!user.walletAddress) {
    logger.info({ telegramId }, 'Wallet not yet created; Privy integration pending');
  }
  return {
    userId: user.id,
    walletAddress: user.walletAddress ?? 'pending',
    privyUserId: user.privyUserId,
  };
}
