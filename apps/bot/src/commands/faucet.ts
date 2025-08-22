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

    const keyboard = new InlineKeyboard()
      .text('🌐 External Faucets Guide', 'faucet_external');

    await ctx.reply(
      `🚰 *Testnet Faucet*

🧪 *TESTNET MODE ACTIVE*

*Your Testnet Wallets:*
🟣 *Solana:* \`${user.solanaWalletAddress || 'Not created'}\`
🔵 *Base:* \`${user.evmWalletAddress || 'Not created'}\`

*⚠️ Use external faucets to get REAL testnet USDC:*`,
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
        `✅ *Faucet Success!*\n\n${chainEmoji} *${result.amount} testnet USDC* sent to your ${chainName} wallet\n\n🧪 *Tx Hash:* \`${result.txHash}\`\n\n💡 Use /balance to check your balance`,
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

export async function handleExternalFaucetGuide(ctx: Context) {
  try {
    await ctx.answerCallbackQuery();
    
    const telegramId = String(ctx.from?.id);
    const user = await getUserByTelegramId(telegramId);
    
    if (!user) {
      return ctx.reply('❌ User not found.');
    }

    await ctx.reply(
      `🌐 *External Testnet Faucets*

*🟣 Solana Devnet USDC Faucets:*
• [Circle USDC Faucet](https://usdcfaucet.com) - Real testnet USDC
• [Solana Cookbook Faucet](https://spl-token-faucet.com/?token-name=USDC-Dev) - SPL USDC
• [QuickNode Faucet](https://faucet.quicknode.com/solana/devnet) - Multi-token faucet
• [Sol Faucet](https://solfaucet.com) - For SOL (transaction fees)
• [Solana Official](https://faucet.solana.com) - For SOL (transaction fees)

*🔵 Base Sepolia Faucets:*
• [Base Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet) - Official Base faucet
• [Alchemy Faucet](https://sepoliafaucet.com) - Sepolia ETH (for gas)
• [Chainlink Faucet](https://faucets.chain.link/base-sepolia) - Base Sepolia ETH

*📋 Your Wallet Addresses:*
🟣 *Solana:* \`${user.solanaWalletAddress || 'Not created'}\`
🔵 *Base:* \`${user.evmWalletAddress || 'Not created'}\`

*🎯 For Hackathon Demo:*
1. Get SOL from Solana faucet for transaction fees
2. Get testnet USDC from USDC faucets
3. Get Base Sepolia ETH for gas fees
4. Use our bot's /faucet for additional testnet USDC

*⚠️ Important:* Save these addresses - you'll need them for faucet requests!`,
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    logger.error({ error }, 'Failed to show external faucet guide');
    await ctx.reply('❌ Failed to show faucet guide. Please try again.');
  }
}
