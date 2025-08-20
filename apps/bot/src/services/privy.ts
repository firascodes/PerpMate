import { prisma } from '../db/client';
import { logger } from '../logger';
import { PrivyClient } from '@privy-io/server-auth';

export type WalletRecord = {
  userId: string;
  walletAddress: string;
  privyUserId?: string | null;
  privateKey?: string; // Only returned on first creation
  isNewWallet?: boolean;
};

function getPrivyClient(): PrivyClient | null {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) return null;
  const authorizationPrivateKey = process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY;
  return new PrivyClient(appId, appSecret, authorizationPrivateKey ? { walletApi: { authorizationPrivateKey } } : undefined);
}

export async function getOrCreateUserWallet(telegramId: string, chainType: 'ethereum' | 'solana' = 'ethereum'): Promise<WalletRecord> {
  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    user = await prisma.user.create({ data: { telegramId } });
  }

  // Check if we already have the wallet for this chain type
  const existingAddress = chainType === 'ethereum' ? user.evmWalletAddress : user.solanaWalletAddress;
  if (existingAddress) {
    return { 
      userId: user.id, 
      walletAddress: existingAddress, 
      privyUserId: user.privyUserId,
      isNewWallet: false 
    };
  }

  const client = getPrivyClient();
  if (!client) {
    logger.warn('Privy env not set. Set PRIVY_APP_ID/PRIVY_APP_SECRET to enable wallet creation.');
    return { userId: user.id, walletAddress: 'pending', privyUserId: user.privyUserId };
  }

  try {
    // Create wallet for the specified chain type
    let created = await (client as any).walletApi.createWallet({ chainType });
    const address: string | undefined = created?.address;
    const walletId: string | undefined = created?.id || created?.walletId;
    const privateKey: string | undefined = created?.privateKey;
    
    if (address) {
      // Update the appropriate wallet fields based on chain type
      const updateData = chainType === 'ethereum' 
        ? { evmWalletAddress: address, evmWalletId: walletId }
        : { solanaWalletAddress: address, solanaWalletId: walletId };
      
      user = await prisma.user.update({ 
        where: { id: user.id }, 
        data: updateData 
      });
      
      logger.info({ telegramId, address, walletId, chainType }, 'Created Privy wallet for user');
      return { 
        userId: user.id, 
        walletAddress: address, 
        privyUserId: user.privyUserId,
        privateKey: privateKey, // Include private key for new wallets
        isNewWallet: true
      };
    }
    
    logger.error({ created }, 'Privy createWallet returned no address');
    return { userId: user.id, walletAddress: 'pending', privyUserId: user.privyUserId };
  } catch (err: any) {
    logger.error({ err, chainType, hint: `Privy createWallet failed for ${chainType}. Check Privy dashboard settings.` }, 'Privy wallet creation failed');
    return { userId: user.id, walletAddress: 'pending', privyUserId: user.privyUserId };
  }
}
