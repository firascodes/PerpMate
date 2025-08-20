import { Context, InlineKeyboard } from 'grammy';
import { checkLiFiConnectivity } from '../services/lifi';
import { getDepositInfo, formatDepositInstructions } from '../services/deposits';
import { startDepositMonitoring } from '../services/monitoring';
import { logger } from '../logger';

// We'll need to pass the monitoredWallets map from the main bot
let globalMonitoredWallets: Map<string, { chain: 'solana' | 'base'; telegramId: string; startTime: Date }> | null = null;

export function setMonitoredWalletsMap(map: Map<string, { chain: 'solana' | 'base'; telegramId: string; startTime: Date }>) {
  globalMonitoredWallets = map;
}

export async function handleFund(ctx: Context) {
  const isConnected = await checkLiFiConnectivity();
  
  if (!isConnected) {
    return ctx.reply('❌ Li.Fi service unavailable. Please try again later.');
  }

  const keyboard = new InlineKeyboard()
    .text('🟣 Solana', 'deposit_solana')
    .text('🔵 Base', 'deposit_base');

  await ctx.reply(
    `💰 **Deposit USDC**\n\nSelect source chain to get your deposit address:`,
    {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    }
  );
}

export async function handleDepositAddress(ctx: Context, chain: 'solana' | 'base') {
  try {
    const telegramId = String(ctx.from?.id);
    
    await ctx.answerCallbackQuery();
    await ctx.reply('⏳ Getting your deposit address...');
    
    const depositInfo = await getDepositInfo(telegramId, chain);
    const instructions = formatDepositInstructions(depositInfo);
    
    await ctx.reply(instructions, { 
      parse_mode: 'Markdown'
    });
    
    // Start monitoring for deposits
    await startDepositMonitoring(depositInfo.walletAddress, chain, telegramId, globalMonitoredWallets || undefined);
    logger.info({ telegramId, chain, walletAddress: depositInfo.walletAddress }, 'Deposit address provided, monitoring started');
    
  } catch (error) {
    logger.error({ error, telegramId: ctx.from?.id, chain }, 'Failed to handle deposit address request');
    await ctx.reply('❌ Failed to get deposit address. Please try again.');
  }
}
