import { logger } from '../logger';
import { isTestnetMode } from '../config/testnet';

export interface MockLiFiRoute {
  id: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  estimate: {
    executionDuration: number;
    gasCosts: Array<{
      amount: string;
      token: string;
    }>;
  };
  steps: Array<{
    type: 'cross' | 'swap';
    tool: string;
    action: {
      fromChain: string;
      toChain: string;
      fromToken: string;
      toToken: string;
      fromAmount: string;
      toAmount: string;
    };
  }>;
}

/**
 * Mock Li.Fi route responses for testnet
 */
export function createMockLiFiRoute(
  sourceChain: 'solana' | 'base',
  amount: number,
  fromAddress: string,
  toAddress: string
): MockLiFiRoute {
  const mockRoute: MockLiFiRoute = {
    id: `mock-route-${Date.now()}`,
    fromChain: sourceChain === 'solana' ? 'solana' : 'base',
    toChain: 'arbitrum',
    fromToken: sourceChain === 'solana' ? 'USDC.SPL' : 'USDC',
    toToken: 'USDC',
    fromAmount: amount.toString(),
    toAmount: (amount * 0.998).toString(), // 0.2% fee simulation
    estimate: {
      executionDuration: sourceChain === 'solana' ? 45 : 30, // seconds
      gasCosts: [
        {
          amount: '0.001',
          token: sourceChain === 'solana' ? 'SOL' : 'ETH'
        }
      ]
    },
    steps: [
      {
        type: 'cross',
        tool: sourceChain === 'solana' ? 'Wormhole' : 'Stargate',
        action: {
          fromChain: sourceChain,
          toChain: 'arbitrum',
          fromToken: sourceChain === 'solana' ? 'USDC.SPL' : 'USDC',
          toToken: 'USDC',
          fromAmount: amount.toString(),
          toAmount: (amount * 0.998).toString()
        }
      }
    ]
  };

  logger.info({ mockRoute, fromAddress, toAddress }, 'Created mock Li.Fi route for testnet');
  return mockRoute;
}

/**
 * Mock Li.Fi route execution with simulated states
 */
export async function executeMockLiFiRoute(route: MockLiFiRoute): Promise<{
  txHash: string;
  status: 'pending' | 'completed' | 'failed';
}> {
  if (!isTestnetMode()) {
    throw new Error('Mock Li.Fi execution only available in testnet mode');
  }

  logger.info({ routeId: route.id }, 'Starting mock Li.Fi route execution');

  // Simulate execution time
  const executionTime = route.estimate.executionDuration * 1000;
  
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
      
      // 95% success rate for testing
      const success = Math.random() > 0.05;
      
      logger.info({ 
        routeId: route.id, 
        txHash: mockTxHash, 
        success 
      }, 'Mock Li.Fi route execution completed');
      
      resolve({
        txHash: mockTxHash,
        status: success ? 'completed' : 'failed'
      });
    }, Math.min(executionTime, 5000)); // Cap at 5 seconds for testing
  });
}

/**
 * Mock testnet faucet for getting test USDC
 */
export async function requestTestnetFaucet(
  walletAddress: string, 
  chain: 'solana' | 'base'
): Promise<{
  success: boolean;
  amount: number;
  txHash?: string;
}> {
  if (!isTestnetMode()) {
    throw new Error('Testnet faucet only available in testnet mode');
  }

  logger.info({ walletAddress, chain }, 'Requesting testnet USDC from faucet');

  // Simulate faucet delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
  const amount = 1000; // 1000 testnet USDC

  // Update testnet balance
  const { addTestnetBalance } = await import('./balance');
  addTestnetBalance(walletAddress, chain, amount);

  logger.info({ 
    walletAddress, 
    chain, 
    amount, 
    txHash: mockTxHash 
  }, 'Testnet USDC faucet successful');

  return {
    success: true,
    amount,
    txHash: mockTxHash
  };
}
