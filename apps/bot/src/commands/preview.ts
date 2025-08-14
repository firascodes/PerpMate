import { Context } from 'grammy';
import { getUserByTelegramId } from '../db/users';
import { getRouteQuote } from '../services/lifi';
import { logger } from '../logger';

export async function handlePreview(ctx: Context) {
  const telegramId = String(ctx.from?.id ?? '');
  
  try {
    const user = await getUserByTelegramId(telegramId);
    if (!user || !user.walletAddress) {
      return ctx.reply('❌ No wallet found. Use /wallet first.');
    }

    // For MVP, preview latest funding intent (if any)
    // In full implementation, this would preview trade orders too
    await ctx.reply('🔍 **Route Preview**\n\nPreview functionality coming soon.\nUse /fund to set up deposits.');
    
  } catch (error) {
    logger.error({ error, telegramId }, 'Preview command error');
    await ctx.reply('❌ Preview temporarily unavailable.');
  }
}
