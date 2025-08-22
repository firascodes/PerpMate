import 'dotenv/config';
import { Bot, InlineKeyboard } from 'grammy';
import express, { Request, Response } from 'express';
import { logger } from './logger';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { handleStart } from './commands/start';
import { handleHelp } from './commands/help';
import { handleWallet } from './commands/wallet';
import { handleFund, handleDepositAddress, setMonitoredWalletsMap } from './commands/fund';
import { handlePreview } from './commands/preview';
import { handleExecute } from './commands/execute';
import { handleActive } from './commands/active';
import { handleLogin } from './commands/login';
import { handleBalance } from './commands/balance';
import { handleFaucet, handleExternalFaucetGuide } from './commands/faucet';
import { 
  handleWithdraw, 
  handleWithdrawChainSelection, 
  handleWithdrawAmount,
  handleWithdrawAddress,
  handleWithdrawConfirm,
  handleWithdrawCancel 
} from './commands/withdraw';
import { getUserByTelegramId } from './db/users';
import { parseTradeCommand, formatTradePreview, suggestCorrection } from './services/nlp';
import { executeTradeOrder } from './services/trading';
import { setupWebhookRoutes } from './services/webhooks';
import { startSignalScheduler, isSchedulerRunning } from './cron/signals';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  logger.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const bot = new Bot(TELEGRAM_BOT_TOKEN);

// Apply rate limiting middleware
bot.use(rateLimitMiddleware);

// In-memory state for natural language commands and monitoring
const pendingCommands = new Map<string, 'trade' | 'fund'>();
const pendingTrades = new Map<string, any>();
const monitoredWallets = new Map<string, { chain: 'solana' | 'base'; telegramId: string; startTime: Date }>(); // Track wallets being monitored for deposits

bot.command('start', handleStart);
bot.command('help', handleHelp);
bot.command('wallet', handleWallet);
bot.command('fund', handleFund);
bot.command('preview', handlePreview);
bot.command('execute', handleExecute);
bot.command('active', handleActive);
bot.command('login', handleLogin);
bot.command('balance', handleBalance);
bot.command('withdraw', handleWithdraw);
bot.command('faucet', handleFaucet);

// Signal testing commands
bot.command('testsignals', async (ctx) => {
  const telegramId = String(ctx.from?.id);
  await ctx.reply('🧪 Testing signal generation...');
  
  try {
    const { testSignalGeneration } = await import('./cron/signals');
    const signals = await testSignalGeneration();
    
    if (signals.length === 0) {
      await ctx.reply('⚠️ No signals generated - market data might be unavailable');
      return;
    }
    
    await ctx.reply(`✅ Generated ${signals.length} test signals:`);
    
    for (const signal of signals) {
      const { formatSignalMessage } = await import('./services/signals');
      const message = formatSignalMessage(signal);
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }
    
  } catch (error) {
    logger.error({ error, telegramId }, 'Failed to test signals');
    await ctx.reply('❌ Signal test failed. Check logs for details.');
  }
});

bot.command('signalstatus', async (ctx) => {
  try {
    const running = isSchedulerRunning();
    const { getSignalAnalytics } = await import('./services/signals');
    const analytics = await getSignalAnalytics();
    
    let message = `📊 **Signal System Status**\n\n`;
    message += `🤖 **Scheduler:** ${running ? '✅ Running' : '❌ Stopped'}\n`;
    
    if (analytics) {
      message += `📈 **Analytics:**\n`;
      message += `• Total signals: ${analytics.totalSignals}\n`;
      message += `• Buy signals: ${analytics.actionBreakdown.buy}\n`;
      message += `• Sell signals: ${analytics.actionBreakdown.sell}\n`;
      message += `• Hold signals: ${analytics.actionBreakdown.hold}\n`;
      message += `• High confidence (70%+): ${analytics.highConfidenceSignals}\n`;
      message += `• Average confidence: ${analytics.averageConfidence.toFixed(1)}%\n`;
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    logger.error({ error }, 'Failed to get signal status');
    await ctx.reply('❌ Failed to get signal status.');
  }
});

bot.command('manualsignal', async (ctx) => {
  const telegramId = String(ctx.from?.id);
  await ctx.reply('🔄 Running manual signal generation...');
  
  try {
    const { runManualSignalJob } = await import('./cron/signals');
    const signals = await runManualSignalJob(bot);
    
    await ctx.reply(`✅ Manual signal job completed! Generated ${signals.length} signals.`);
    
  } catch (error) {
    logger.error({ error, telegramId }, 'Failed to run manual signal job');
    await ctx.reply('❌ Manual signal job failed.');
  }
});
bot.command('checkdeposits', async (ctx) => {
  const telegramId = String(ctx.from?.id);
  await ctx.reply('🔍 Manually checking for deposits...');
  
  for (const [walletAddress, info] of monitoredWallets.entries()) {
    if (info.telegramId === telegramId) {
      const { checkForDeposits, handleDepositDetected } = await import('./services/monitoring');
      const depositAmount = await checkForDeposits(walletAddress, info.chain);
      
      if (depositAmount) {
        await handleDepositDetected(bot, telegramId, {
          walletAddress,
          chain: info.chain,
          amount: depositAmount,
          timestamp: new Date(),
        });
        await ctx.reply(`✅ Found deposit: ${depositAmount} USDC on ${info.chain}`);
      } else {
        await ctx.reply(`ℹ️ No new deposits found on ${info.chain}`);
      }
    }
  }
});

bot.command('activate', async (ctx) => {
  const telegramId = String(ctx.from?.id);
  await ctx.reply('🎯 Activating Hyperliquid account...');
  
  try {
    const user = await getUserByTelegramId(telegramId);
    if (!user?.evmWalletId || !user?.evmWalletAddress) {
      return ctx.reply('❌ EVM wallet not found. Use /wallet first.');
    }
    
    const { activateHyperliquidAccount } = await import('./services/hyperliquid');
    const activated = await activateHyperliquidAccount(user.evmWalletId, user.evmWalletAddress);
    
    if (activated) {
      await ctx.reply('✅ *Hyperliquid Account Activated!*\n\nYou can now start trading. Try: `buy 10 btc`', { parse_mode: 'Markdown' });
    } else {
      await ctx.reply('⚠️ *Activation Failed*\n\nMake sure you have USDC in your wallet. Use /fund to deposit.', { parse_mode: 'Markdown' });
    }
  } catch (error) {
    logger.error({ error, telegramId }, 'Failed to activate Hyperliquid account');
    await ctx.reply('❌ Activation failed. Please try again.');
  }
});

// Inline button callbacks (help)
bot.callbackQuery('help_wallet', async (ctx) => ctx.answerCallbackQuery({ text: 'Use /wallet to view/create your wallet.' }));
bot.callbackQuery('help_fund', async (ctx) => ctx.answerCallbackQuery({ text: 'Use /fund to fund from Solana/Base via Li.Fi.' }));
bot.callbackQuery('help_withdraw', async (ctx) => ctx.answerCallbackQuery({ text: 'Use /withdraw to send USDC to external address.' }));
bot.callbackQuery('help_balance', async (ctx) => ctx.answerCallbackQuery({ text: 'Use /balance to check your USDC balances.' }));
bot.callbackQuery('help_faucet', async (ctx) => ctx.answerCallbackQuery({ text: 'Use /faucet to get testnet USDC (testnet only).' }));
bot.callbackQuery('help_active', async (ctx) => ctx.answerCallbackQuery({ text: 'Use /active to view open positions.' }));
bot.callbackQuery('help_execute', async (ctx) => ctx.answerCallbackQuery({ text: 'Execute coming soon.' }));
bot.callbackQuery('help_active', async (ctx) => ctx.answerCallbackQuery({ text: 'Active positions coming soon.' }));

// Inline button callbacks (deposit addresses)
bot.callbackQuery('deposit_solana', async (ctx) => {
  await handleDepositAddress(ctx, 'solana');
});

bot.callbackQuery('deposit_base', async (ctx) => {
  await handleDepositAddress(ctx, 'base');
});

// Trade confirmation callbacks
bot.callbackQuery(/confirm_trade_(\d+)/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const telegramId = String(ctx.from?.id);
  
  // Get stored trade intent
  const tradeIntent = pendingTrades.get(telegramId);
  if (!tradeIntent) {
    await ctx.reply('❌ Trade session expired. Please try again.');
    return;
  }
  
  // Execute the trade
  await executeTradeOrder(bot, telegramId, tradeIntent);
  
  // Clean up
  pendingCommands.delete(telegramId);
  pendingTrades.delete(telegramId);
});

bot.callbackQuery('cancel_trade', async (ctx) => {
  await ctx.answerCallbackQuery();
  const telegramId = String(ctx.from?.id);
  pendingCommands.delete(telegramId);
  await ctx.reply('❌ Trade cancelled.');
});

// Faucet callbacks (external only)
bot.callbackQuery('faucet_external', async (ctx) => {
  await handleExternalFaucetGuide(ctx);
});

// Withdraw callbacks
bot.callbackQuery('withdraw_solana', async (ctx) => {
  await handleWithdrawChainSelection(ctx, 'solana');
});

bot.callbackQuery('withdraw_base', async (ctx) => {
  await handleWithdrawChainSelection(ctx, 'base');
});

bot.callbackQuery('withdraw_confirm', async (ctx) => {
  await handleWithdrawConfirm(ctx);
});

bot.callbackQuery('withdraw_cancel', async (ctx) => {
  await handleWithdrawCancel(ctx);
});

// Handle wallet callbacks
bot.callbackQuery('export_keys', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Private key export feature coming soon!' });
  await ctx.reply('🔧 *Export Feature Coming Soon*\n\nFor now, please save the private keys shown above manually.');
});

bot.callbackQuery('refresh_wallets', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Refreshing wallets...' });
  await handleWallet(ctx);
});

// Natural language trading and withdraw handler
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text?.trim() || '';
  const telegramId = String(ctx.from?.id);
  
  // Check if user is in withdraw flow first
  const { hasActiveWithdrawSession, handleWithdrawAmount, handleWithdrawAddress } = await import('./commands/withdraw');
  
  try {
    const withdrawSession = hasActiveWithdrawSession(telegramId);
    if (withdrawSession) {
      if (withdrawSession.step === 'enter_amount') {
        return await handleWithdrawAmount(ctx, text);
      } else if (withdrawSession.step === 'enter_address') {
        return await handleWithdrawAddress(ctx, text);
      }
    }
  } catch (error) {
    // Continue to natural language trading if withdraw handling fails
  }
  
  // Skip if it's a command
  if (text.startsWith('/')) return;
  
  try {
    // Show typing indicator while processing with Gemini
    await ctx.replyWithChatAction('typing');
    
    const tradeIntent = await parseTradeCommand(text);
    
    if (tradeIntent.isValid) {
      // Valid trade command detected
      const preview = formatTradePreview(tradeIntent);
      
      const keyboard = new InlineKeyboard()
        .text('✅ Confirm Trade', `confirm_trade_${Date.now()}`)
        .text('❌ Cancel', 'cancel_trade');
      
      await ctx.reply(preview, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });
      
      // Store trade intent for confirmation
      pendingCommands.set(telegramId, 'trade');
      pendingTrades.set(telegramId, tradeIntent);
      
    } else if (tradeIntent.confidence > 0.05) {
      // Partial match or general guidance - suggest corrections
      const suggestion = suggestCorrection(tradeIntent);
      await ctx.reply(suggestion, { parse_mode: 'Markdown' });
    }
    // If confidence is very low (< 0.05), ignore (casual conversation)
    
  } catch (error) {
    logger.error({ error, text, telegramId }, 'Error processing natural language command');
  }
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

// Setup webhook endpoints for real-time deposit detection (production)
setupWebhookRoutes(app, bot);

async function main() {
  const port = Number(process.env.PORT || 8080);
  
  // Set up monitored wallets map for fund command
  setMonitoredWalletsMap(monitoredWallets);
  
  await bot.start();
  app.listen(port, () => logger.info({ port }, 'HTTP server listening'));
  
  // Start polling mechanism for now (until webhooks are deployed)
  const { startDepositMonitoringLoop } = await import('./services/monitoring');
  startDepositMonitoringLoop(bot, monitoredWallets);
  
  // Start signal generation scheduler
  startSignalScheduler(bot);
  
  logger.info('Bot started with deposit monitoring and signal scheduler');
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error');
  process.exit(1);
});
