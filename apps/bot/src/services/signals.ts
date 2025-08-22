import { logger } from '../logger';
import { initHlClients, fetchUniverse } from './hyperliquid';
import { prisma } from '../db/client';
import * as hl from '@nktkas/hyperliquid';

export interface SignalData {
  asset: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string[];
  rsi: number;
  volumeRatio: number;
  fundingRate: number;
  timestamp: Date;
}

export interface MarketData {
  price: number;
  volume24h: number;
  volumeAverage: number;
  rsi: number;
  fundingRate: number;
}

/**
 * Calculate RSI (Relative Strength Index) from price data
 * RSI = 100 - (100 / (1 + RS))
 * RS = Average Gain / Average Loss
 */
function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) {
    return 50; // Neutral if not enough data
  }

  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate gains and losses
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains.push(change);
      losses.push(0);
    } else {
      gains.push(0);
      losses.push(Math.abs(change));
    }
  }

  // Calculate average gains and losses over period
  const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
  const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;

  if (avgLoss === 0) return 100; // All gains
  if (avgGain === 0) return 0;   // All losses

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
}

/**
 * Fetch market data for a given asset from Hyperliquid
 */
async function fetchMarketData(asset: string): Promise<MarketData | null> {
  try {
    // Use a dummy wallet for info client (read-only operations)
    const dummyWalletId = 'dummy';
    const dummyAddress = '0x0000000000000000000000000000000000000001';
    
    const { info } = initHlClients(dummyWalletId, dummyAddress);
    
    // Get asset metadata and current context
    const { meta, ctx } = await fetchUniverse(info);
    const assetIndex = meta.universe.findIndex((a: any) => a.name.toUpperCase() === asset.toUpperCase());
    
    if (assetIndex === -1) {
      logger.warn({ asset }, 'Asset not found in universe');
      return null;
    }

    const assetCtx = ctx[assetIndex];
    const currentPrice = parseFloat(assetCtx.markPx);
    const fundingRate = parseFloat(assetCtx.funding) * 100; // Convert to percentage

    // Get 24h volume data and historical candles for RSI calculation
    const candles = await info.candleSnapshot({
      coin: asset.toUpperCase(),
      interval: '1h',
      startTime: Date.now() - (24 * 60 * 60 * 1000), // 24 hours ago
      endTime: Date.now()
    }) as any;

    if (!candles || !candles.length) {
      logger.warn({ asset }, 'No candle data available');
      return null;
    }

    // Extract prices and volumes from candles
    const prices = candles.map((c: any) => parseFloat(c.c)); // Close prices
    const volumes = candles.map((c: any) => parseFloat(c.v)); // Volumes
    
    // Calculate 24h volume and average volume
    const volume24h = volumes.reduce((sum: number, vol: number) => sum + vol, 0);
    const volumeAverage = volume24h / volumes.length;

    // Calculate RSI from hourly close prices
    const rsi = calculateRSI(prices);

    logger.info({ 
      asset, 
      currentPrice, 
      rsi, 
      fundingRate, 
      volume24h,
      volumeAverage,
      candlesCount: candles.length 
    }, 'Market data fetched');

    return {
      price: currentPrice,
      volume24h,
      volumeAverage,
      rsi,
      fundingRate
    };

  } catch (error) {
    logger.error({ error, asset }, 'Failed to fetch market data');
    return null;
  }
}

/**
 * Generate trading signal based on technical analysis
 */
export async function generateSignal(asset: string): Promise<SignalData | null> {
  try {
    logger.info({ asset }, 'Generating trading signal');

    const marketData = await fetchMarketData(asset);
    if (!marketData) {
      return null;
    }

    const { rsi, fundingRate, volume24h, volumeAverage } = marketData;
    
    // Calculate volume ratio
    const volumeRatio = volume24h / volumeAverage;

    // Signal criteria
    const reasoning: string[] = [];
    let confidence = 0;
    let action: 'buy' | 'sell' | 'hold' = 'hold';

    // RSI Analysis
    if (rsi < 30) {
      reasoning.push(`RSI oversold at ${rsi.toFixed(1)} (opportunity to buy)`);
      confidence += 25;
      action = 'buy';
    } else if (rsi > 70) {
      reasoning.push(`RSI overbought at ${rsi.toFixed(1)} (consider selling)`);
      confidence += 25;
      action = 'sell';
    } else {
      reasoning.push(`RSI neutral at ${rsi.toFixed(1)}`);
    }

    // Volume Analysis
    if (volumeRatio > 1.5) {
      reasoning.push(`Volume surge ${volumeRatio.toFixed(1)}x above average`);
      confidence += 20;
    } else if (volumeRatio < 0.7) {
      reasoning.push(`Low volume ${volumeRatio.toFixed(1)}x below average`);
      confidence -= 10;
    } else {
      reasoning.push(`Volume normal at ${volumeRatio.toFixed(1)}x average`);
    }

    // Funding Rate Analysis
    if (fundingRate > 1.0) {
      reasoning.push(`Extreme positive funding ${fundingRate.toFixed(2)}% (shorts pay longs)`);
      confidence += 15;
      if (action === 'buy') confidence += 10; // Reinforces buy signal
    } else if (fundingRate < -1.0) {
      reasoning.push(`Extreme negative funding ${fundingRate.toFixed(2)}% (longs pay shorts)`);
      confidence += 15;
      if (action === 'sell') confidence += 10; // Reinforces sell signal
    } else if (fundingRate > 0.5) {
      reasoning.push(`High positive funding ${fundingRate.toFixed(2)}%`);
      confidence += 10;
    } else if (fundingRate < -0.5) {
      reasoning.push(`High negative funding ${fundingRate.toFixed(2)}%`);
      confidence += 10;
    } else {
      reasoning.push(`Neutral funding rate ${fundingRate.toFixed(2)}%`);
    }

    // Confluence Analysis - when multiple indicators align
    if ((rsi < 30 && fundingRate < 0) || (rsi > 70 && fundingRate > 0)) {
      reasoning.push(`Strong confluence detected`);
      confidence += 20;
    }

    // Bullish divergence detection (simplified)
    if (rsi < 35 && volumeRatio > 1.2 && fundingRate < -0.3) {
      reasoning.push(`Potential bullish divergence detected`);
      confidence += 15;
      action = 'buy';
    }

    // Bearish divergence detection (simplified)
    if (rsi > 65 && volumeRatio > 1.2 && fundingRate > 0.3) {
      reasoning.push(`Potential bearish divergence detected`);
      confidence += 15;
      action = 'sell';
    }

    // Cap confidence at 100
    confidence = Math.min(confidence, 100);

    // If confidence is too low, change to hold
    if (confidence < 40) {
      action = 'hold';
      reasoning.push(`Confidence too low for trade signal`);
    }

    const signal: SignalData = {
      asset: asset.toUpperCase(),
      action,
      confidence,
      reasoning,
      rsi,
      volumeRatio,
      fundingRate,
      timestamp: new Date()
    };

    logger.info({ signal }, 'Signal generated successfully');
    return signal;

  } catch (error) {
    logger.error({ error, asset }, 'Failed to generate signal');
    return null;
  }
}

/**
 * Generate signals for all supported assets
 */
export async function generateAllSignals(): Promise<SignalData[]> {
  const assets = ['BTC', 'ETH', 'SOL'];
  const signals: SignalData[] = [];

  logger.info({ assets }, 'Generating signals for all assets');

  for (const asset of assets) {
    try {
      const signal = await generateSignal(asset);
      if (signal) {
        signals.push(signal);
      }
      
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      logger.error({ error, asset }, 'Failed to generate signal for asset');
    }
  }

  logger.info({ signalCount: signals.length }, 'All signals generated');
  return signals;
}

/**
 * Save signal to database
 */
export async function saveSignal(signal: SignalData, broadcastCount: number = 0): Promise<string | null> {
  try {
    const savedSignal = await prisma.signal.create({
      data: {
        asset: signal.asset,
        action: signal.action,
        confidence: signal.confidence,
        reasoning: signal.reasoning,
        rsi: signal.rsi,
        volumeRatio: signal.volumeRatio,
        fundingRate: signal.fundingRate,
        broadcastTo: broadcastCount
      }
    });

    logger.info({ signalId: savedSignal.id, asset: signal.asset }, 'Signal saved to database');
    return savedSignal.id;

  } catch (error) {
    logger.error({ error, signal }, 'Failed to save signal to database');
    return null;
  }
}

/**
 * Get recent signals for an asset
 */
export async function getRecentSignals(asset: string, limit: number = 10): Promise<any[]> {
  try {
    const signals = await prisma.signal.findMany({
      where: { asset: asset.toUpperCase() },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return signals;
  } catch (error) {
    logger.error({ error, asset }, 'Failed to get recent signals');
    return [];
  }
}

/**
 * Get signal performance analytics
 */
export async function getSignalAnalytics(asset?: string): Promise<any> {
  try {
    const whereClause = asset ? { asset: asset.toUpperCase() } : {};
    
    const [totalSignals, buySignals, sellSignals, holdSignals, highConfidenceSignals] = await Promise.all([
      prisma.signal.count({ where: whereClause }),
      prisma.signal.count({ where: { ...whereClause, action: 'buy' } }),
      prisma.signal.count({ where: { ...whereClause, action: 'sell' } }),
      prisma.signal.count({ where: { ...whereClause, action: 'hold' } }),
      prisma.signal.count({ where: { ...whereClause, confidence: { gte: 70 } } })
    ]);

    const averageConfidence = await prisma.signal.aggregate({
      where: whereClause,
      _avg: { confidence: true }
    });

    return {
      totalSignals,
      actionBreakdown: {
        buy: buySignals,
        sell: sellSignals,
        hold: holdSignals
      },
      highConfidenceSignals,
      averageConfidence: averageConfidence._avg.confidence || 0
    };

  } catch (error) {
    logger.error({ error, asset }, 'Failed to get signal analytics');
    return null;
  }
}

/**
 * Format signal for Telegram message
 */
export function formatSignalMessage(signal: SignalData): string {
  const actionEmoji = signal.action === 'buy' ? '🟢' : signal.action === 'sell' ? '🔴' : '⚪';
  const confidenceEmoji = signal.confidence >= 80 ? '🔥' : signal.confidence >= 60 ? '⚡' : '📊';
  
  let actionText = signal.action.toUpperCase();
  if (signal.action === 'buy') actionText = 'STRONG BUY';
  if (signal.action === 'sell') actionText = 'STRONG SELL';

  const timeStr = signal.timestamp.toLocaleString('en-US', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  let message = `${confidenceEmoji} **${signal.asset} Signal Alert**\n\n`;
  message += `${actionEmoji} **Action:** ${actionText}\n`;
  message += `📈 **Confidence:** ${signal.confidence}%\n`;
  message += `⏰ **Time:** ${timeStr}\n\n`;
  
  message += `📋 **Analysis:**\n`;
  signal.reasoning.forEach((reason, index) => {
    message += `• ${reason}\n`;
  });

  message += `\n📊 **Technical Data:**\n`;
  message += `• RSI (14): ${signal.rsi.toFixed(1)}\n`;
  message += `• Volume: ${signal.volumeRatio.toFixed(1)}x avg\n`;
  message += `• Funding: ${signal.fundingRate.toFixed(2)}%\n`;

  if (signal.confidence >= 60) {
    message += `\n💡 **Suggested Action:** Consider ${signal.action}ing ${signal.asset} with appropriate position sizing`;
  } else {
    message += `\n⚠️ **Note:** Low confidence - wait for stronger signals`;
  }

  return message;
}