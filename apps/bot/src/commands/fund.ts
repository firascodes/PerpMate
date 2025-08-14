import { Context, InlineKeyboard } from 'grammy';
import { checkLiFiConnectivity } from '../services/lifi';

export async function handleFund(ctx: Context) {
  const isConnected = await checkLiFiConnectivity();
  
  if (!isConnected) {
    return ctx.reply('❌ Li.Fi service unavailable. Please try again later.');
  }

  const keyboard = new InlineKeyboard()
    .text('💙 Solana', 'fund_src_solana')
    .text('🔵 Base', 'fund_src_base');

  await ctx.reply(
    `💰 **Deposit USDC**\n\nSelect source chain to fund your Hyperliquid account:`,
    {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    }
  );
}
