import { Context } from 'grammy';
import { getOrCreateUserWallet } from '../services/privy';

export async function handleWallet(ctx: Context) {
  try {
    const telegramId = String(ctx.from?.id ?? 'unknown');
    
    // Get both Ethereum and Solana wallets
    const evmWallet = await getOrCreateUserWallet(telegramId, 'ethereum');
    const solanaWallet = await getOrCreateUserWallet(telegramId, 'solana');
    
    if (evmWallet.walletAddress === 'pending' || solanaWallet.walletAddress === 'pending') {
      await ctx.reply('🔧 Setting up your multi-chain wallets. Please wait...');
      return;
    }
    
    const message = `🔐 **Your Multi-Chain Wallets**

🔵 **EVM (Base, Arbitrum):**
\`${evmWallet.walletAddress}\`

🟣 **Solana:**
\`${solanaWallet.walletAddress}\`

💡 Use /fund to get specific deposit instructions`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (err: any) {
    const msg =
      err?.message?.includes('Environment variable not found: DATABASE_URL')
        ? 'Database not configured. Please set DATABASE_URL in apps/bot/.env and run migrations.'
        : 'Unexpected error. Please try again later.';
    await ctx.reply(msg);
  }
}
