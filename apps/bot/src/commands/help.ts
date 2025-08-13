import { Context, InlineKeyboard } from 'grammy';

export async function handleHelp(ctx: Context) {
  const kb = new InlineKeyboard()
    .text('Wallet', 'help_wallet')
    .text('Fund', 'help_fund')
    .row()
    .text('Preview', 'help_preview')
    .text('Execute', 'help_execute')
    .row()
    .text('Active', 'help_active');

  const msg = [
    'Commands:',
    '- /start — start and onboarding info',
    '- /wallet — show or create your embedded wallet',
    '- /fund — fund-in via Li.Fi (Solana/Base → HyperEVM/Hyperliquid)',
    '- /preview — build order preview',
    '- /execute — place a market order (MVP)',
    '- /active — show open positions/orders',
  ].join('\n');

  await ctx.reply(msg, { reply_markup: kb });
}
