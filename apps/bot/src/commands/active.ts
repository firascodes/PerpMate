import { Context } from 'grammy';
import { getUserByTelegramId } from '../db/users';
import { fetchUniverse, fetchUserState, getAssetIndexBySymbol, initHlClients } from '../services/hyperliquid';

export async function handleActive(ctx: Context) {
  const telegramId = String(ctx.from?.id ?? '');
  if (!telegramId) return ctx.reply('Unable to resolve user.');
  const user = await getUserByTelegramId(telegramId);
  if (!user?.walletAddress || !user?.walletId) return ctx.reply('Wallet not ready. Run /wallet first.');

  try {
    const { info } = initHlClients(user.walletId, user.walletAddress);
    const { meta }: any = await fetchUniverse(info);
    const state: any = await fetchUserState(info, user.walletAddress);

    const positions = (state?.assetPositions || [])
      .map((p: any, i: number) => ({ i, p }))
      .filter(({ p }: any) => Number(p?.position?.szi || 0) !== 0)
      .map(({ i, p }: any) => {
        const name = meta.universe[i]?.name || `#${i}`;
        const size = Number(p.position.szi);
        const side = size > 0 ? 'LONG' : 'SHORT';
        const entry = Number(p.position.entryPx || 0).toFixed(2);
        const pnl = Number(p.position.unrealizedPnl || 0).toFixed(2);
        return `${name}: ${side} ${Math.abs(size)} @ ${entry} | uPnL ${pnl}`;
      });

    if (!positions.length) return ctx.reply('No open positions.');
    return ctx.reply(positions.join('\n'));
  } catch (e: any) {
    return ctx.reply(`Failed to load positions: ${e?.message || 'unknown error'}`);
  }
}

