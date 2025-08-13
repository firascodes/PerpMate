import { Context, InlineKeyboard } from 'grammy';
import axios from 'axios';

export async function handleFund(ctx: Context) {
  try {
    const resp = await axios.get('https://li.quest/v1/tools', { timeout: 10_000 });
    const data = resp.data;
    const bridges = Array.isArray(data.bridges) ? data.bridges.slice(0, 3).map((b: any) => b.name) : [];
    const exchanges = Array.isArray(data.exchanges) ? data.exchanges.slice(0, 3).map((e: any) => e.name) : [];

    const kb = new InlineKeyboard()
      .text('Fund from Solana', 'fund_from_solana')
      .text('Fund from Base', 'fund_from_base')
      .row()
      .text('Preview Route', 'fund_preview');

    const msg = [
      'Li.Fi',
      `Sample bridges: ${bridges.join(', ')}`,
      `Exchanges: ${exchanges.join(', ')}`,
      'Supported fund-in chains for MVP: Solana, Base. We will route to HyperEVM/Hyperliquid.',
      '',
      'Tap a button to continue:',
    ].join('\n');

    await ctx.reply(msg, { reply_markup: kb });
  } catch (err) {
    await ctx.reply('Li.Fi connectivity failed. Try again in a bit.');
  }
}
