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

    // Check Solana balance
    if (user.solanaWalletAddress) {
      try {
        const solanaBalance = await getUSDCBalance(user.solanaWalletAddress, 'solana');
        message += `🟣 **Solana**: ${solanaBalance.toFixed(6)} USDC\n`;
        totalBalance += solanaBalance;
      } catch (error) {
        message += `🟣 **Solana**: Error checking balance\n`;
        logger.error({ error, wallet: user.solanaWalletAddress }, 'Failed to check Solana balance');
      }
    }

    // Check Base balance  
    if (user.evmWalletAddress) {
      try {
        const baseBalance = await getUSDCBalance(user.evmWalletAddress, 'base');
        message += `🔵 **Base**: ${baseBalance.toFixed(6)} USDC\n`;
        totalBalance += baseBalance;
      } catch (error) {
        message += `🔵 **Base**: Error checking balance\n`;
        logger.error({ error, wallet: user.evmWalletAddress }, 'Failed to check Base balance');
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
