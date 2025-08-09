import { Context } from 'grammy';
import { getOrCreateUserWallet } from '../services/privy';

export async function handleWallet(ctx: Context) {
  const telegramId = String(ctx.from?.id ?? 'unknown');
  const wallet = await getOrCreateUserWallet(telegramId);
  await ctx.reply(
    wallet.walletAddress === 'pending'
      ? 'Wallet creation is being set up. Please try again shortly.'
      : `Your wallet: ${wallet.walletAddress}`
  );
}
