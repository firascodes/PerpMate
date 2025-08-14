import { createConfig, getQuote as lifiGetQuote, getTools } from '@lifi/sdk';
import { logger } from '../logger';

// Initialize Li.Fi configuration
let isConfigured = false;

function ensureLiFiConfig() {
  if (!isConfigured) {
    createConfig({
      integrator: 'PerpMate',
      ...(process.env.LIFI_API_KEY && { apiKey: process.env.LIFI_API_KEY }),
    });
    isConfigured = true;
  }
}

export async function checkLiFiConnectivity(): Promise<boolean> {
  try {
    ensureLiFiConfig();
    const tools = await getTools();
    logger.info({ toolsAvailable: !!tools }, 'Li.Fi connectivity OK');
    return true;
  } catch (error) {
    logger.error({ error }, 'Li.Fi connectivity failed');
    return false;
  }
}

export async function getRouteQuote(
  sourceChain: 'solana' | 'base', 
  amount: number, 
  fromAddress: string,
  toAddress: string
) {
  try {
    ensureLiFiConfig();
    
    // Map chain names to Li.Fi chain IDs (use numeric values)
    const chainMap = {
      'solana': 1151111081099710, // Solana mainnet
      'base': 8453, // Base mainnet
    };
    
    const quote = await lifiGetQuote({
      fromAddress,
      fromChain: chainMap[sourceChain],
      fromToken: 'USDC', // USDC symbol
      fromAmount: (amount * 1e6).toString(), // USDC has 6 decimals
      toChain: 42161, // Arbitrum (HyperEVM)
      toToken: 'USDC',
      toAddress,
      slippage: 0.03, // 3% slippage tolerance
    });
    
    logger.info({ sourceChain, amount, quoteAvailable: !!quote }, 'Route quote generated');
    return quote;
  } catch (error) {
    logger.error({ error, sourceChain, amount }, 'Failed to get route quote');
    throw error;
  }
}

// Legacy type for backward compatibility
export type LifiQuoteParams = {
  fromChain?: string;
  fromToken?: string;
  amount?: string;
  toChain?: string;
  toToken?: string;
  recipient?: string;
};

export async function getQuote(_params: LifiQuoteParams) {
  // Placeholder: real implementation will call Li.Fi quote endpoint with API key
  return { routes: [], etaMinutes: 0, feeUsd: 0 };
}
