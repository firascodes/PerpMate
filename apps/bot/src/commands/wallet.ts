import { Context, InlineKeyboard } from 'grammy';
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
    
    // Check if any wallet is newly created
    const hasNewWallets = evmWallet.isNewWallet || solanaWallet.isNewWallet;
    
    let message = `🔐 **Your Multi-Chain Wallets**

🔵 **EVM (Base, Arbitrum):**
\`${evmWallet.walletAddress}\`

🟣 **Solana:**
\`${solanaWallet.walletAddress}\`

💡 Use /fund to get specific deposit instructions`;

    const keyboard = new InlineKeyboard();
    
    if (hasNewWallets) {
      // Show private keys and export option for new wallets
      message += `\n\n🔑 **IMPORTANT - First Time Setup**\n\n⚠️ **Save your private keys safely!**`;
      
      if (evmWallet.isNewWallet && evmWallet.privateKey) {
        message += `\n\n🔵 **EVM Private Key:**\n\`${evmWallet.privateKey}\``;
      }
      
      if (solanaWallet.isNewWallet && solanaWallet.privateKey) {
        message += `\n\n🟣 **Solana Private Key:**\n\`${solanaWallet.privateKey}\``;
      }
      
      message += `\n\n🛡️ **Security Notice:**\n• Keep these private keys secure\n• Never share them with anyone\n• Store them in a safe place\n• You won't see them again!`;
      
      keyboard.text('💾 Export Keys as File', 'export_keys').row();
    }
    
    keyboard.text('🔄 Refresh Wallets', 'refresh_wallets');

    await ctx.reply(message, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (err: any) {
    const msg =
      err?.message?.includes('Environment variable not found: DATABASE_URL')
        ? 'Database not configured. Please set DATABASE_URL in apps/bot/.env and run migrations.'
        : 'Unexpected error. Please try again later.';
    await ctx.reply(msg);
  }
}
