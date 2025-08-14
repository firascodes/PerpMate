import 'dotenv/config';
import { Bot } from 'grammy';
import express, { Request, Response } from 'express';
import { logger } from './logger';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { handleStart } from './commands/start';
import { handleHelp } from './commands/help';
import { handleWallet } from './commands/wallet';
import { handleFund } from './commands/fund';
import { handlePreview } from './commands/preview';
import { handleExecute } from './commands/execute';
import { handleActive } from './commands/active';
import { getUserByTelegramId } from './db/users';
import { logFundingIntent } from './db/funding';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  logger.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const bot = new Bot(TELEGRAM_BOT_TOKEN);

// Apply rate limiting middleware
bot.use(rateLimitMiddleware);

// In-memory pending funding source by user
const pendingSource = new Map<string, 'solana' | 'base'>();

bot.command('start', handleStart);
bot.command('help', handleHelp);
bot.command('wallet', handleWallet);
bot.command('fund', handleFund);
bot.command('preview', handlePreview);
bot.command('execute', handleExecute);
bot.command('active', handleActive);

// Inline button callbacks (help)
bot.callbackQuery('help_wallet', async (ctx) => ctx.answerCallbackQuery({ text: 'Use /wallet to view/create your wallet.' }));
bot.callbackQuery('help_fund', async (ctx) => ctx.answerCallbackQuery({ text: 'Use /fund to fund from Solana/Base via Li.Fi.' }));
bot.callbackQuery('help_preview', async (ctx) => ctx.answerCallbackQuery({ text: 'Preview coming soon.' }));
bot.callbackQuery('help_execute', async (ctx) => ctx.answerCallbackQuery({ text: 'Execute coming soon.' }));
bot.callbackQuery('help_active', async (ctx) => ctx.answerCallbackQuery({ text: 'Active positions coming soon.' }));

// Inline button callbacks (fund)
bot.callbackQuery('fund_src_solana', async (ctx) => {
  await ctx.answerCallbackQuery();
  pendingSource.set(String(ctx.from?.id), 'solana');
  await ctx.reply(
    `💙 **Solana → Hyperliquid**\n\nOnly USDC supported.\nEnter amount (e.g., 50):`,
    { parse_mode: 'Markdown' }
  );
});

bot.callbackQuery('fund_src_base', async (ctx) => {
  await ctx.answerCallbackQuery();
  pendingSource.set(String(ctx.from?.id), 'base');
  await ctx.reply(
    `🔵 **Base → Hyperliquid**\n\nOnly USDC supported.\nEnter amount (e.g., 50):`,
    { parse_mode: 'Markdown' }
  );
});

// Capture next text as amount for funding intent
bot.on('message:text', async (ctx) => {
  const userIdKey = String(ctx.from?.id ?? '');
  const source = pendingSource.get(userIdKey);
  if (!source) return; // not in funding flow

  const text = ctx.message.text?.trim() || '';
  const amount = Number(text);
  if (!amount || !isFinite(amount) || amount <= 0) {
    return ctx.reply('Please enter a valid USDC amount (e.g., 50).');
  }

  const user = await getUserByTelegramId(userIdKey);
  if (!user) return ctx.reply('User not found. Try /start again.');

  await logFundingIntent(user.id, source, amount);
  pendingSource.delete(userIdKey);

  await ctx.reply(
    `✅ **Deposit Intent Logged**\n\n💰 ${amount} USDC from ${source.toUpperCase()}\n\nUse /preview to see route details before execution.`,
    { parse_mode: 'Markdown' }
  );
});

bot.catch((err) => {
  logger.error({ err }, 'Bot error');
});

const app = express();

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Metrics endpoint (basic)
app.get('/metrics', (_req: Request, res: Response) => {
  const usage = process.memoryUsage();
  res.json({
    memory: {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

async function main() {
  const port = Number(process.env.PORT || 8080);
  await bot.start();
  app.listen(port, () => logger.info({ port }, 'HTTP server listening'));
  logger.info('Bot started');
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error');
  process.exit(1);
});
