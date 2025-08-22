import { Bot } from 'grammy';
import { logger } from '../logger';
import { generateAllSignals, formatSignalMessage, SignalData, saveSignal } from '../services/signals';
import { getAllUsers } from '../db/users';

interface SignalScheduler {
  isRunning: boolean;
  intervalId?: NodeJS.Timeout;
}

const scheduler: SignalScheduler = {
  isRunning: false,
};

/**
 * Broadcast signals to all registered users
 */
async function broadcastSignals(bot: Bot, signals: SignalData[]): Promise<void> {
  try {
    // Filter signals with confidence > 60% (configurable threshold)
    const significantSignals = signals.filter(signal => signal.confidence >= 60);
    
    if (significantSignals.length === 0) {
      logger.info('No significant signals to broadcast');
      return;
    }

    // Get all users who want to receive signals
    const users = await getAllUsers();
    if (!users || users.length === 0) {
      logger.info('No users to send signals to');
      return;
    }

    logger.info({ 
      signalCount: significantSignals.length, 
      userCount: users.length 
    }, 'Broadcasting signals to users');

    // Send signals to all users
    let successfulBroadcasts = 0;
    for (const user of users) {
      if (!user.telegramId) continue;

      try {
        // Send a header message
        await bot.api.sendMessage(
          user.telegramId,
          `🚨 **Hourly Signal Update**\n\nFound ${significantSignals.length} significant signal(s) for you:`,
          { parse_mode: 'Markdown' }
        );

        // Send each significant signal
        for (const signal of significantSignals) {
          const message = formatSignalMessage(signal);
          await bot.api.sendMessage(
            user.telegramId,
            message,
            { parse_mode: 'Markdown' }
          );

          // Small delay between messages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Add a footer with action prompts
        await bot.api.sendMessage(
          user.telegramId,
          `💡 **Ready to trade?** Try:\n• \`buy 10 ${significantSignals[0].asset.toLowerCase()}\`\n• \`short ${significantSignals[0].asset.toLowerCase()} 50 usdc\`\n\nUse /balance to check your funds!`,
          { parse_mode: 'Markdown' }
        );

        successfulBroadcasts++;

      } catch (error) {
        logger.error({ error, telegramId: user.telegramId }, 'Failed to send signal to user');
      }

      // Small delay between users to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Save signals to database with broadcast count
    for (const signal of significantSignals) {
      await saveSignal(signal, successfulBroadcasts);
    }

    logger.info({ broadcastCount: successfulBroadcasts }, 'Signal broadcast completed');

  } catch (error) {
    logger.error({ error }, 'Failed to broadcast signals');
  }
}

/**
 * Main signal generation and broadcasting job
 */
async function runSignalJob(bot: Bot): Promise<void> {
  try {
    logger.info('Starting hourly signal generation job');
    
    const startTime = Date.now();
    
    // Generate signals for all assets
    const signals = await generateAllSignals();
    
    if (signals.length === 0) {
      logger.warn('No signals generated - market data might be unavailable');
      return;
    }

    // Log all generated signals for debugging
    signals.forEach(signal => {
      logger.info({ 
        asset: signal.asset,
        action: signal.action,
        confidence: signal.confidence,
        rsi: signal.rsi,
        volumeRatio: signal.volumeRatio,
        fundingRate: signal.fundingRate
      }, 'Generated signal');
    });

    // Broadcast significant signals to users
    await broadcastSignals(bot, signals);

    const duration = Date.now() - startTime;
    logger.info({ 
      duration,
      signalCount: signals.length 
    }, 'Signal generation job completed');

  } catch (error) {
    logger.error({ error }, 'Signal generation job failed');
  }
}

/**
 * Start the signal generation scheduler
 * Runs every hour at the top of the hour
 */
export function startSignalScheduler(bot: Bot): void {
  if (scheduler.isRunning) {
    logger.warn('Signal scheduler already running');
    return;
  }

  logger.info('Starting signal scheduler');
  
  // Calculate time until next hour
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0); // Next hour at :00 minutes
  const msUntilNextHour = nextHour.getTime() - now.getTime();

  // Run first job at the next hour
  setTimeout(() => {
    // Run immediately at the hour
    runSignalJob(bot);
    
    // Then run every hour
    scheduler.intervalId = setInterval(() => {
      runSignalJob(bot);
    }, 60 * 60 * 1000); // 1 hour in milliseconds
    
  }, msUntilNextHour);

  scheduler.isRunning = true;
  
  logger.info({ 
    nextRun: nextHour.toISOString(),
    msUntilNextHour 
  }, 'Signal scheduler started - first run scheduled');
}

/**
 * Stop the signal generation scheduler
 */
export function stopSignalScheduler(): void {
  if (!scheduler.isRunning) {
    logger.warn('Signal scheduler not running');
    return;
  }

  if (scheduler.intervalId) {
    clearInterval(scheduler.intervalId);
    scheduler.intervalId = undefined;
  }

  scheduler.isRunning = false;
  logger.info('Signal scheduler stopped');
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return scheduler.isRunning;
}

/**
 * Run signal job manually (for testing)
 */
export async function runManualSignalJob(bot: Bot): Promise<SignalData[]> {
  logger.info('Running manual signal generation job');
  
  const signals = await generateAllSignals();
  await broadcastSignals(bot, signals);
  
  return signals;
}

/**
 * Test signal generation without broadcasting (for debugging)
 */
export async function testSignalGeneration(): Promise<SignalData[]> {
  logger.info('Testing signal generation (no broadcast)');
  
  const signals = await generateAllSignals();
  
  signals.forEach(signal => {
    logger.info({ 
      asset: signal.asset,
      action: signal.action,
      confidence: signal.confidence,
      reasoning: signal.reasoning
    }, 'Test signal generated');
  });

  return signals;
}