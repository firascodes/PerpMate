import { Context, InlineKeyboard } from 'grammy';
import { isTestnetMode } from '../config/testnet';
import { requestTestnetFaucet } from '../services/lifi-mock';
import { getUserByTelegramId } from '../db/users';
import { logger } from '../logger';

export async function handleFaucet(ctx: Context) {
  if (!isTestnetMode()) {
    return ctx.reply('❌ Faucet only available in testnet mode.');
  }

  const telegramId = String(ctx.from?.id);
  
  try {
    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      return ctx.reply('❌ User not found. Use /start first.');
    }

    if (!user.solanaWalletAddress && !user.evmWalletAddress) {
      return ctx.reply('❌ No wallets found. Use /wallet to create wallets first.');
    }

    const keyboard = new InlineKeyboard();
    
    if (user.solanaWalletAddress) {
      keyboard.text('🟣 Get Solana USDC', 'faucet_solana');
    }
    
    if (user.evmWalletAddress) {
      keyboard.text('🔵 Get Base USDC', 'faucet_base');
    }

    await ctx.reply(
      `🚰 **Testnet Faucet**\n\nGet 1000 testnet USDC for testing:`,
      {
        reply_markup: keyboard,
        parse_mode: 'Markdown',
      }
    );

  } catch (error) {
    logger.error({ error, telegramId }, 'Failed to handle faucet command');
    await ctx.reply('❌ Failed to access faucet. Please try again.');
  }
}

export async function handleFaucetRequest(ctx: Context, chain: 'solana' | 'base') {
  if (!isTestnetMode()) {
    return ctx.answerCallbackQuery({ text: 'Faucet only available in testnet mode.' });
  }

  try {
    const telegramId = String(ctx.from?.id);
    await ctx.answerCallbackQuery();
    await ctx.reply('🚰 Requesting testnet USDC...');

    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      return ctx.reply('❌ User not found.');
    }

    const walletAddress = chain === 'solana' ? user.solanaWalletAddress : user.evmWalletAddress;
    if (!walletAddress) {
      return ctx.reply(`❌ ${chain === 'solana' ? 'Solana' : 'Base'} wallet not found.`);
    }

    const result = await requestTestnetFaucet(walletAddress, chain);

    if (result.success) {
      const chainEmoji = chain === 'solana' ? '🟣' : '🔵';
      const chainName = chain === 'solana' ? 'Solana' : 'Base';
      
      await ctx.reply(
        `✅ **Faucet Success!**\n\n${chainEmoji} **${result.amount} testnet USDC** sent to your ${chainName} wallet\n\n🧪 **Tx Hash:** \`${result.txHash}\`\n\n💡 Use /balance to check your balance`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply('❌ Faucet request failed. Please try again.');
    }

  } catch (error) {
    logger.error({ error, chain }, 'Failed to handle faucet request');
    await ctx.reply('❌ Faucet request failed. Please try again.');
  }
}
