import { Context } from 'grammy';
import { getOrCreateUserWallet } from '../services/privy';

export async function handleWallet(ctx: Context) {
  try {
    const telegramId = String(ctx.from?.id ?? 'unknown');
    const wallet = await getOrCreateUserWallet(telegramId);
    await ctx.reply(
      wallet.walletAddress === 'pending'
        ? 'Wallet creation is being set up. Please try again shortly.'
        : `Your wallet: ${wallet.walletAddress}`
    );
  } catch (err: any) {
    const msg =
      err?.message?.includes('Environment variable not found: DATABASE_URL')
        ? 'Database not configured. Please set DATABASE_URL in apps/bot/.env and run migrations.'
        : 'Unexpected error. Please try again later.';
    await ctx.reply(msg);
  }
}
