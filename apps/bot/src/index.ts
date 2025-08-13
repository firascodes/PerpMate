import 'dotenv/config';
import { Bot } from 'grammy';
import express from 'express';
import { logger } from './logger';
import { handleStart } from './commands/start';
import { handleHelp } from './commands/help';
import { handleWallet } from './commands/wallet';
import { handleFund } from './commands/fund';
import { handleExecute } from './commands/execute';
import { handleActive } from './commands/active';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  logger.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const bot = new Bot(TELEGRAM_BOT_TOKEN);

bot.command('start', handleStart);
bot.command('help', handleHelp);
bot.command('wallet', handleWallet);
bot.command('fund', handleFund);
bot.command('execute', handleExecute);
bot.command('active', handleActive);

// Inline button callbacks
bot.callbackQuery('help_wallet', async (ctx) => ctx.answerCallbackQuery({ text: 'Use /wallet to view/create your wallet.' }));
bot.callbackQuery('help_fund', async (ctx) => ctx.answerCallbackQuery({ text: 'Use /fund to fund from Solana/Base via Li.Fi.' }));
bot.callbackQuery('help_preview', async (ctx) => ctx.answerCallbackQuery({ text: 'Preview coming soon.' }));
bot.callbackQuery('help_execute', async (ctx) => ctx.answerCallbackQuery({ text: 'Execute coming soon.' }));
bot.callbackQuery('help_active', async (ctx) => ctx.answerCallbackQuery({ text: 'Active positions coming soon.' }));

bot.callbackQuery('fund_from_solana', async (ctx) => ctx.answerCallbackQuery({ text: 'Funding from Solana: preview flow coming.' }));
bot.callbackQuery('fund_from_base', async (ctx) => ctx.answerCallbackQuery({ text: 'Funding from Base: preview flow coming.' }));
bot.callbackQuery('fund_preview', async (ctx) => ctx.answerCallbackQuery({ text: 'Route preview coming.' }));

bot.catch((err) => {
  logger.error({ err }, 'Bot error');
});

const app = express();
app.get('/health', (_req, res) => res.json({ ok: true }));

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
