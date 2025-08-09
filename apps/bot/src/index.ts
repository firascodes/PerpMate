import 'dotenv/config';
import { Bot } from 'grammy';
import express from 'express';
import { logger } from './logger';
import { handleStart } from './commands/start';
import { handleHelp } from './commands/help';
import { handleWallet } from './commands/wallet';
import { handleFund } from './commands/fund';

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

// Placeholders
bot.command('preview', (ctx) => ctx.reply('Order preview coming soon.'));
bot.command('execute', (ctx) => ctx.reply('Execute flow coming soon.'));
bot.command('active', (ctx) => ctx.reply('Active positions view coming soon.'));

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
