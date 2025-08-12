import { prisma } from '../db/client';
import { logger } from '../logger';
import { PrivyClient } from '@privy-io/server-auth';

export type WalletRecord = {
  userId: string;
  walletAddress: string;
  privyUserId?: string | null;
};

function getPrivyClient(): PrivyClient | null {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) return null;
  const authorizationPrivateKey = process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY;
  return new PrivyClient(appId, appSecret, authorizationPrivateKey ? { walletApi: { authorizationPrivateKey } } : undefined);
}

export async function getOrCreateUserWallet(telegramId: string): Promise<WalletRecord> {
  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    user = await prisma.user.create({ data: { telegramId } });
  }

  if (user.walletAddress) {
    return { userId: user.id, walletAddress: user.walletAddress, privyUserId: user.privyUserId };
  }

  const client = getPrivyClient();
  if (!client) {
    logger.warn('Privy env not set. Set PRIVY_APP_ID/PRIVY_APP_SECRET to enable wallet creation.');
    return { userId: user.id, walletAddress: 'pending', privyUserId: user.privyUserId };
  }

  try {
    // Prefer camelCase per current Privy docs
    let created = await (client as any).walletApi.createWallet({ chainType: 'ethereum' });
    const address: string | undefined = created?.address;
    const walletId: string | undefined = created?.id || created?.walletId;
    if (address) {
      user = await prisma.user.update({ where: { id: user.id }, data: { walletAddress: address, walletId } });
      logger.info({ telegramId, address, walletId }, 'Created Privy wallet for user');
      return { userId: user.id, walletAddress: address, privyUserId: user.privyUserId };
    }
    logger.error({ created }, 'Privy createWallet returned no address');
    return { userId: user.id, walletAddress: 'pending', privyUserId: user.privyUserId };
  } catch (err: any) {
    logger.error({ err, hint: 'Privy createWallet failed. Try ensuring chainType is correct (ethereum) and restart the bot.' }, 'Privy wallet creation failed');
    return { userId: user.id, walletAddress: 'pending', privyUserId: user.privyUserId };
  }
}
