import 'dotenv/config';
import { Bot } from 'grammy';
import express from 'express';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  logger.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const bot = new Bot(TELEGRAM_BOT_TOKEN);

bot.command('start', (ctx) => ctx.reply('PerpMate bot ready. Use /wallet to get started.'));
bot.command('help', (ctx) => ctx.reply('Commands: /start, /wallet, /fund, /preview, /execute, /active'));

// Placeholder commands (wired later)
bot.command('wallet', (ctx) => ctx.reply('Wallet setup coming soon.'));
bot.command('fund', (ctx) => ctx.reply('Li.Fi fund-in flow coming soon.'));
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
