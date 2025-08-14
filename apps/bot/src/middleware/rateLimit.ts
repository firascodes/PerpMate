import { Context, NextFunction } from 'grammy';
import { logger } from '../logger';

const userLastCommand = new Map<string, number>();
const RATE_LIMIT_MS = 1000; //  seconds between commands

export async function rateLimitMiddleware(ctx: Context, next: NextFunction) {
  const userId = String(ctx.from?.id ?? '');
  if (!userId) return next();

  const now = Date.now();
  const lastCommand = userLastCommand.get(userId) || 0;

  if (now - lastCommand < RATE_LIMIT_MS) {
    logger.warn({ userId, rateLimited: true }, 'Rate limited user');
    return ctx.reply('Please wait a moment between commands.');
  }

  userLastCommand.set(userId, now);
  return next();
}
