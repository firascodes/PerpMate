import { Context } from 'grammy';
import axios from 'axios';

export async function handleFund(ctx: Context) {
  try {
    const resp = await axios.get('https://li.quest/v1/tools', {
      timeout: 10_000,
    });
    const data = resp.data;
    const bridges = Array.isArray(data.bridges) ? data.bridges.slice(0, 3).map((b: any) => b.name) : [];
    const exchanges = Array.isArray(data.exchanges) ? data.exchanges.slice(0, 3).map((e: any) => e.name) : [];

    await ctx.reply(
      [
        'Li.Fi connectivity OK.',
        `Sample bridges: ${bridges.join(', ')}`,
        `Exchanges: ${exchanges.join(', ')}`,
        'Supported fund-in chains for MVP: Solana, Base. We will route to HyperEVM/Hyperliquid.',
      ].join('\n')
    );
  } catch (err) {
    await ctx.reply('Li.Fi connectivity failed. Try again in a bit.');
  }
}
