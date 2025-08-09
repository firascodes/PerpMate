import { Context } from 'grammy';
import axios from 'axios';

export async function handleFund(ctx: Context) {
  try {
    const resp = await axios.get('https://li.quest/v1/tools', {
      headers: {
        'x-lifi-api-key': process.env.LIFI_API_KEY || '',
      },
      timeout: 10_000,
    });
    const data = resp.data;
    const bridges = Array.isArray(data.bridges) ? data.bridges.slice(0, 3) : [];
    const exchanges = Array.isArray(data.exchanges) ? data.exchanges.slice(0, 3) : [];
    await ctx.reply(
      `Li.Fi connectivity OK. Sample bridges: ${bridges
        .map((b: any) => b.name)
        .join(', ')} | exchanges: ${exchanges.map((e: any) => e.name).join(', ')}`
    );
  } catch (err) {
    await ctx.reply('Li.Fi connectivity failed. Please set LIFI_API_KEY and try again.');
  }
}
