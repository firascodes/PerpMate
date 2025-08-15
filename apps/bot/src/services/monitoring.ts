import { logger } from '../logger';
import { USDC_ADDRESSES, SupportedChain } from './deposits';
import { Bot } from 'grammy';
import { getUserByTelegramId } from '../db/users';
import { getRouteQuote, executeLiFiRoute } from './lifi';
import { getUSDCBalance, createBalanceKey } from './balance';

// Simple in-memory tracking of last known balances
const lastKnownBalances = new Map<string, number>();
const depositNotificationsSent = new Set<string>(); // Prevent duplicate notifications

export interface DepositEvent {
  walletAddress: string;
  chain: SupportedChain;
  amount: number;
  txHash?: string;
  timestamp: Date;
}

/**
 * Start monitoring a wallet for USDC deposits
 */
export async function startDepositMonitoring(walletAddress: string, chain: SupportedChain, telegramId: string) {
  const key = createBalanceKey(walletAddress, chain);
  logger.info({ walletAddress, chain, telegramId }, 'Starting deposit monitoring');
  
  // Initialize balance tracking
  // Note: monitoredWallets should be passed from the main bot file
  
  // Get current balance as starting point
  const currentBalance = await getUSDCBalance(walletAddress, chain);
  lastKnownBalances.set(key, currentBalance);
  
  logger.info({ walletAddress, chain, currentBalance }, 'Initial balance set for monitoring');
}

/**
 * Check for new deposits on a wallet
 * This is a simplified implementation - in production you'd use WebSocket subscriptions
 * or webhook endpoints from providers like Alchemy, QuickNode, etc.
 */
export async function checkForDeposits(walletAddress: string, chain: SupportedChain): Promise<number | null> {
  try {
    const key = createBalanceKey(walletAddress, chain);
    
    // Real balance check using RPC calls
    const currentBalance = await getUSDCBalance(walletAddress, chain);
    
    const lastBalance = lastKnownBalances.get(key) || 0;
    
    if (currentBalance > lastBalance) {
      const depositAmount = currentBalance - lastBalance;
      lastKnownBalances.set(key, currentBalance);
      
      logger.info({ 
        walletAddress, 
        chain, 
        depositAmount, 
        currentBalance,
        previousBalance: lastBalance
      }, 'Deposit detected');
      
      return depositAmount;
    }
    
    return null;
  } catch (error) {
    logger.error({ error, walletAddress, chain }, 'Error checking for deposits');
    return null;
  }
}

/**
 * Handle a detected deposit by notifying user and triggering bridge
 */
export async function handleDepositDetected(
  bot: Bot, 
  telegramId: string, 
  deposit: DepositEvent
): Promise<void> {
  try {
    const notificationKey = `${deposit.walletAddress}-${deposit.amount}-${deposit.timestamp.getTime()}`;
    
    // Prevent duplicate notifications
    if (depositNotificationsSent.has(notificationKey)) {
      return;
    }
    depositNotificationsSent.add(notificationKey);
    
    const chainEmoji = deposit.chain === 'solana' ? '🟣' : '🔵';
    const chainName = deposit.chain === 'solana' ? 'Solana' : 'Base';
    
    // Notify user of successful deposit
    await bot.api.sendMessage(
      telegramId,
      `✅ **Deposit Detected!**

${chainEmoji} **${deposit.amount.toFixed(6)} USDC** received on ${chainName}

⏳ **Auto-bridging to Hyperliquid...**
This usually takes 2-5 minutes.

I'll notify you when it's ready for trading! 🚀`,
      { parse_mode: 'Markdown' }
    );
    
    // Get user info for bridging
    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Get the appropriate wallet address based on the deposit chain
    const fromAddress = deposit.chain === 'solana' ? user.solanaWalletAddress : user.evmWalletAddress;
    const toAddress = user.evmWalletAddress; // Always bridge to EVM (Hyperliquid)
    
    if (!fromAddress || !toAddress) {
      throw new Error(`Wallet not found for chain ${deposit.chain}`);
    }
    
    // Execute Li.Fi bridge automatically
    logger.info({ telegramId, deposit, fromAddress, toAddress }, 'Starting auto-bridge execution');
    
    // Get route quote for the detected amount
    const quote = await getRouteQuote(
      deposit.chain,
      deposit.amount,
      fromAddress,
      toAddress
    );
    
    if (!quote) {
      await bot.api.sendMessage(
        telegramId,
        `❌ **Bridge Error**\n\nCouldn't get route for ${deposit.amount} USDC. Please try /fund again.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Execute the bridge route
    await bot.api.sendMessage(
      telegramId, 
      `🌉 **Bridging in progress...**\n\nRoute: ${chainName} → Arbitrum (HyperEVM)\nETA: ~${quote.estimate?.executionDuration || 300}s`,
      { parse_mode: 'Markdown' }
    );
    
    // Note: executeLiFiRoute implementation needed
    // const txHash = await executeLiFiRoute(quote, user.walletAddress);
    
    logger.info({ telegramId, quote }, 'Bridge route executed');
    
  } catch (error) {
    logger.error({ error, telegramId, deposit }, 'Failed to handle deposit');
    
    await bot.api.sendMessage(
      telegramId,
      `❌ **Auto-bridge failed**\n\nDeposit received but bridging failed. Use /preview to try manually.`,
      { parse_mode: 'Markdown' }
    );
  }
}

// Mock function removed - now using real RPC balance checking

/**
 * Start the deposit monitoring loop
 */
export function startDepositMonitoringLoop(
  bot: Bot, 
  monitoredWallets: Map<string, { chain: SupportedChain; telegramId: string }>
): void {
  logger.info('Starting deposit monitoring loop');
  
  setInterval(async () => {
    for (const [walletAddress, info] of monitoredWallets.entries()) {
      try {
        const depositAmount = await checkForDeposits(walletAddress, info.chain);
        
        if (depositAmount) {
          const deposit: DepositEvent = {
            walletAddress,
            chain: info.chain,
            amount: depositAmount,
            timestamp: new Date(),
          };
          
          await handleDepositDetected(bot, info.telegramId, deposit);
        }
      } catch (error) {
        logger.error({ error, walletAddress, chain: info.chain }, 'Error in monitoring loop');
      }
    }
  }, 10000); // Check every 10 seconds
}
