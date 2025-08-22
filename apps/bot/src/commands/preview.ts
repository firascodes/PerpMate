import { Context } from 'grammy';
import { getUserByTelegramId } from '../db/users';
import { getRouteQuote } from '../services/lifi';
import { logger } from '../logger';
import { prisma } from '../db/client';

export async function handlePreview(ctx: Context) {
  const telegramId = String(ctx.from?.id ?? '');
  
  try {
    const user = await getUserByTelegramId(telegramId);
    if (!user || !user.evmWalletAddress) {
      return ctx.reply('❌ No EVM wallet found. Use /wallet first.');
    }

    // Get the latest funding intent for this user
    const latestIntent = await prisma.fundingIntent.findFirst({
      where: { userId: user.id, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestIntent) {
      return ctx.reply('🔍 *Route Preview*\n\nNo pending deposits found.\nUse /fund to set up a deposit first.');
    }

    // For MVP, show intent details without actual quote (needs fromAddress)
    await ctx.reply(
      `🔍 *Route Preview*\n\n` +
      `💰 Amount: ${latestIntent.amount} ${latestIntent.token}\n` +
      `📤 From: ${latestIntent.sourceChain.toUpperCase()}\n` +
      `📥 To: Hyperliquid (Arbitrum)\n` +
      `📍 Destination: ${user.evmWalletAddress}\n\n` +
      `⚠️ Execution coming soon in Phase 1 completion.`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    logger.error({ error, telegramId }, 'Preview command error');
    await ctx.reply('❌ Preview temporarily unavailable.');
  }
}
