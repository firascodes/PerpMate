import { logger } from '../logger';
import { TradeIntent } from './nlp';
import { getUserByTelegramId } from '../db/users';
import { initHlClients, fetchUniverse, getAssetIndexBySymbol, placeMarketOrderHL, checkUserExists } from './hyperliquid';
import { Bot } from 'grammy';

export interface TradeExecution {
  success: boolean;
  orderId?: string;
  error?: string;
  txHash?: string;
}

/**
 * Execute a trade on Hyperliquid based on parsed natural language intent
 */
export async function executeTradeOrder(
  bot: Bot,
  telegramId: string, 
  tradeIntent: TradeIntent
): Promise<TradeExecution> {
  try {
    logger.info({ telegramId, tradeIntent }, 'Executing trade order');
    
    // Get user and wallet info
    const user = await getUserByTelegramId(telegramId);
    if (!user || !user.evmWalletId || !user.evmWalletAddress) {
      throw new Error('EVM wallet not found - use /wallet to create one');
    }
    
    // Initialize Hyperliquid clients
    const { exchange, info } = initHlClients(user.evmWalletId, user.evmWalletAddress);
    
    // Check if wallet exists on Hyperliquid
    const walletExists = await checkUserExists(info, user.evmWalletAddress, 'mainnet');
    if (!walletExists) {
      throw new Error(`Wallet not activated on Hyperliquid. Please fund your wallet first using /fund or visit https://app.hyperliquid.xyz to activate.`);
    }
    
    // Fetch universe metadata to get asset indices
    const { meta } = await fetchUniverse(info);
    const assetIndex = getAssetIndexBySymbol(meta, tradeIntent.asset);
    
    if (assetIndex === -1) {
      throw new Error(`Asset ${tradeIntent.asset} not found on Hyperliquid`);
    }
    
    // Calculate trade parameters
    const isBuy = tradeIntent.action === 'buy' || tradeIntent.action === 'long';
    const baseSize = tradeIntent.amount || 10; // Default $10 if no amount specified
    const leverage = tradeIntent.leverage || 1;
    const sizeWithLeverage = baseSize * leverage;
    
    // Place market order
    await bot.api.sendMessage(
      telegramId,
      `⏳ *Placing ${tradeIntent.action.toUpperCase()} order...*\n\n` +
      `Asset: ${tradeIntent.asset}\n` +
      `Size: $${sizeWithLeverage} (${leverage}x leverage)\n` +
      `Type: Market Order`,
      { parse_mode: 'Markdown' }
    );
    
    const orderResult = await placeMarketOrderHL(exchange, {
      assetIndex,
      buy: isBuy,
      size: sizeWithLeverage,
    });
    
    logger.info({ telegramId, orderResult }, 'Trade order placed');
    
    // Extract order ID from result (structure depends on Hyperliquid response)
    const orderId = (orderResult as any)?.response?.data?.statuses?.[0]?.resting?.oid || 'unknown';
    
    // Send success notification
    await bot.api.sendMessage(
      telegramId,
      `✅ *Trade Executed Successfully!*\n\n` +
      `📈 ${tradeIntent.action.toUpperCase()} ${tradeIntent.asset}\n` +
      `💰 Size: $${sizeWithLeverage}\n` +
      `📊 Leverage: ${leverage}x\n` +
      `🆔 Order ID: \`${orderId}\`\n\n` +
      `Use /active to see your positions!`,
      { parse_mode: 'Markdown' }
    );
    
    return {
      success: true,
      orderId,
      txHash: undefined, // Market orders don't have tx hashes
    };
    
  } catch (error) {
    logger.error({ error, telegramId, tradeIntent }, 'Failed to execute trade');
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let userMessage = `❌ *Trade Failed*\n\n${errorMessage}`;
    
    // Provide specific guidance based on error type
    if (errorMessage.includes('not activated') || errorMessage.includes('does not exist')) {
      userMessage += `\n\n💡 *Next Steps:*\n• Use \`/fund\` to deposit USDC and activate your wallet\n• Or visit https://app.hyperliquid.xyz to activate manually`;
    } else if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
      userMessage += `\n\n💡 *Next Steps:*\n• Check your balance with \`/balance\`\n• Deposit more USDC using \`/fund\``;
    } else if (errorMessage.includes('not found')) {
      userMessage += `\n\n💡 **Available assets:** BTC, ETH, SOL`;
    }
    
    userMessage += `\n\n🔧 *Need help?* Use \`/help\` for guidance.`;
    
    await bot.api.sendMessage(
      telegramId,
      userMessage,
      { parse_mode: 'Markdown' }
    );
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get user's current positions and open orders
 */
export async function getUserPositions(telegramId: string): Promise<any> {
  try {
    const user = await getUserByTelegramId(telegramId);
    if (!user || !user.evmWalletId || !user.evmWalletAddress) {
      return { positions: [], openOrders: [] };
    }
    
    const { info } = initHlClients(user.evmWalletId, user.evmWalletAddress);
    const userState = await info.clearinghouseState({ user: user.evmWalletAddress } as any);
    
    return userState;
  } catch (error) {
    logger.error({ error, telegramId }, 'Failed to get user positions');
    return { positions: [], openOrders: [] };
  }
}

/**
 * Format positions for display in Telegram
 */
export function formatPositionsMessage(positions: any): string {
  if (!positions || !positions.assetPositions || positions.assetPositions.length === 0) {
    return '📊 *No Active Positions*\n\nYou have no open positions. Use natural language to place a trade:\n\n• `buy 50 btc`\n• `short eth 100 usdc`';
  }
  
  let message = '📊 *Your Active Positions*\n\n';
  
  for (const pos of positions.assetPositions) {
    const asset = pos.position?.coin || 'Unknown';
    const size = parseFloat(pos.position?.szi || '0');
    const entryPx = parseFloat(pos.position?.entryPx || '0');
    const unrealizedPnl = parseFloat(pos.position?.unrealizedPnl || '0');
    const side = size > 0 ? 'LONG' : 'SHORT';
    const sizeAbs = Math.abs(size);
    const pnlEmoji = unrealizedPnl >= 0 ? '🟢' : '🔴';
    
    message += `*${asset}* ${side}\n`;
    message += `• Size: ${sizeAbs.toFixed(4)}\n`;
    message += `• Entry: $${entryPx.toFixed(2)}\n`;
    message += `• PnL: ${pnlEmoji} $${unrealizedPnl.toFixed(2)}\n\n`;
  }
  
  return message;
}
