import { Context } from 'grammy';
import { getUserByTelegramId } from '../db/users';
import { fetchUniverse, getAssetIndexBySymbol, initHlClients, placeMarketOrderHL } from '../services/hyperliquid';
import { prisma } from '../db/client';

function parseArgs(text?: string) {
  // Usage: /execute <asset=BTC> <side=buy|sell> <notionalUsd=5> <lev=3>
  const parts = (text || '').trim().split(/\s+/).filter(Boolean).slice(1);
  const asset = (parts[0] || 'BTC').toUpperCase();
  const side = (parts[1] || 'buy').toLowerCase() === 'sell' ? 'sell' : 'buy';
  const notionalUsd = Number(parts[2] || 5);
  const leverage = Number(parts[3] || 3);
  return { asset, side, notionalUsd, leverage };
}

export async function handleExecute(ctx: Context) {
  const { asset, side, notionalUsd, leverage } = parseArgs(ctx.message?.text);
  const telegramId = String(ctx.from?.id ?? '');
  if (!telegramId) return ctx.reply('Unable to resolve user.');

  const user = await getUserByTelegramId(telegramId);
  if (!user?.evmWalletAddress || !user?.evmWalletId) {
    return ctx.reply('EVM wallet not ready. Run /wallet first.');
  }

  try {
    const { exchange, info } = initHlClients(user.evmWalletId, user.evmWalletAddress);
    const { meta, ctx: assetCtxs }: any = await fetchUniverse(info);
    const idx = getAssetIndexBySymbol(meta, asset);
    if (idx < 0) return ctx.reply(`Asset ${asset} not found on Hyperliquid.`);

    const markPx = Number(assetCtxs[idx]?.markPx || 0);
    if (!markPx || !isFinite(markPx)) return ctx.reply('Unable to fetch price. Try again.');

    const size = notionalUsd / markPx; // approximate size in contracts from USD
    const buy = side === 'buy';

    await ctx.reply(`Placing market ${buy ? 'BUY' : 'SELL'} ${asset} ~ $${notionalUsd} (lev ${leverage})...`);

    const res = await placeMarketOrderHL(exchange, { assetIndex: idx, buy, size });

    await prisma.trade.create({
      data: {
        userId: user.id,
        asset,
        side: buy ? 'LONG' : 'SHORT',
        notionalUsd,
        leverage,
        orderRef: String((res as any)?.orderId || ''),
        status: 'submitted',
      },
    });

    return ctx.reply('Order submitted. Use /active to check positions.');
  } catch (e: any) {
    return ctx.reply(`Order failed: ${e?.message || 'unknown error'}`);
  }
}

