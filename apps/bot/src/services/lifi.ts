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
    
    // Detect destination chain from address format
    const getDestinationChain = (address: string): number => {
      // Solana addresses are base58 encoded, 32-44 characters
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        return 1151111081099710; // Solana
      }
      // EVM addresses start with 0x and are 42 characters
      else if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return 42161; // Arbitrum (HyperEVM) for EVM addresses
      } else {
        throw new Error(`Invalid destination address format: ${address}`);
      }
    };
    
    const destinationChain = getDestinationChain(toAddress);
    
    logger.info({ 
      sourceChain, 
      destinationChain, 
      fromAddress: fromAddress.slice(0, 8) + '...', 
      toAddress: toAddress.slice(0, 8) + '...' 
    }, 'Routing parameters');
    
    const quote = await lifiGetQuote({
      fromAddress,
      fromChain: chainMap[sourceChain],
      fromToken: 'USDC', // USDC symbol
      fromAmount: (amount * 1e6).toString(), // USDC has 6 decimals
      toChain: destinationChain,
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

export interface RouteExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Execute a Li.Fi route (bridge transaction)
 */
export async function executeLiFiRoute(route: any, walletId: string): Promise<RouteExecutionResult> {
  try {
    logger.info({ routeId: route.id, walletId }, 'Executing Li.Fi route');
    
    // Import Privy client for signing
    const { PrivyClient } = await import('@privy-io/server-auth');
    const privyClient = new PrivyClient(
      process.env.PRIVY_APP_ID!,
      process.env.PRIVY_APP_SECRET!
    );
    
    // Get Privy signer for this wallet
    const signer = await (privyClient as any).walletApi.createEthersSigner({ 
      walletId,
      chainId: route.fromChainId 
    });
    
    if (!signer) {
      throw new Error('Failed to create Privy signer');
    }
    
    // Execute the Li.Fi route transaction
    const transactionRequest = route.transactionRequest;
    
    // Estimate gas and execute
    const gasEstimate = await signer.estimateGas(transactionRequest);
    const gasPrice = await signer.getGasPrice();
    
    const txResponse = await signer.sendTransaction({
      ...transactionRequest,
      gasLimit: gasEstimate,
      gasPrice: gasPrice,
    });
    
    logger.info({ 
      txHash: txResponse.hash, 
      walletId,
      routeId: route.id 
    }, 'Li.Fi route transaction submitted');
    
    // Wait for confirmation
    const receipt = await txResponse.wait(1);
    
    if (receipt.status === 1) {
      logger.info({ 
        txHash: receipt.transactionHash, 
        blockNumber: receipt.blockNumber 
      }, 'Li.Fi route execution successful');
      
      return {
        success: true,
        txHash: receipt.transactionHash
      };
    } else {
      throw new Error('Transaction failed');
    }
    
  } catch (error) {
    logger.error({ error, routeId: route?.id, walletId }, 'Failed to execute Li.Fi route');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function getQuote(_params: LifiQuoteParams) {
  // Placeholder: real implementation will call Li.Fi quote endpoint with API key
  return { routes: [], etaMinutes: 0, feeUsd: 0 };
}
