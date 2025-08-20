import { Context } from 'grammy';
import { getUserByTelegramId } from '../db/users';
import { getUSDCBalance } from '../services/balance';
import { logger } from '../logger';

export async function handleBalance(ctx: Context) {
  try {
    const telegramId = String(ctx.from?.id);
    
    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      return ctx.reply('❌ User not found. Use /start first.');
    }

    await ctx.reply('💰 Checking your balances...');

    let message = '💰 **Your USDC Balances**\n\n';
    let totalBalance = 0;

    // Query balances in parallel for better UX
    const balancePromises: Array<Promise<{ label: string; value: number }>> = [];

    if (user.solanaWalletAddress) {
      balancePromises.push(
        getUSDCBalance(user.solanaWalletAddress, 'solana')
          .then((v) => ({ label: 'solana', value: v }))
          .catch(() => ({ label: 'solana', value: NaN }))
      );
    }
    if (user.evmWalletAddress) {
      balancePromises.push(
        getUSDCBalance(user.evmWalletAddress, 'base')
          .then((v) => ({ label: 'base', value: v }))
          .catch(() => ({ label: 'base', value: NaN }))
      );
    }

    const results = await Promise.all(balancePromises);
    for (const res of results) {
      if (res.label === 'solana') {
        if (Number.isNaN(res.value)) {
          message += `🟣 **Solana**: Error checking balance\n`;
        } else {
          message += `🟣 **Solana**: ${res.value.toFixed(6)} USDC\n`;
          totalBalance += res.value;
        }
      }
      if (res.label === 'base') {
        if (Number.isNaN(res.value)) {
          message += `🔵 **Base**: Error checking balance\n`;
        } else {
          message += `🔵 **Base**: ${res.value.toFixed(6)} USDC\n`;
          totalBalance += res.value;
        }
      }
    }

    message += `\n💎 **Total**: ${totalBalance.toFixed(6)} USDC`;

    if (totalBalance > 0) {
      message += `\n\n🚀 Ready to trade! Use natural language like:\n• "buy 0.1 btc"\n• "long eth with 2x leverage"`;
    } else {
      message += `\n\n💡 Fund your wallet using /fund to start trading`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });

  } catch (error) {
    logger.error({ error, telegramId: ctx.from?.id }, 'Failed to check balances');
    await ctx.reply('❌ Failed to check balances. Please try again.');
  }
}
