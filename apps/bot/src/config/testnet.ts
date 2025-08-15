/**
 * Testnet configuration for safe testing
 */

export const TESTNET_CONFIG = {
  // Hyperliquid Testnet
  HL_BASE_URL: 'https://api.hyperliquid-testnet.xyz',
  HYPEREVM_RPC_URL: 'https://rpc.hyperliquid-testnet.xyz/evm',
  
  // Chain configurations for testnet
  CHAINS: {
    solana: {
      rpcUrl: 'https://api.devnet.solana.com',
      usdcAddress: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', // Devnet USDC
    },
    base: {
      rpcUrl: 'https://sepolia.base.org',
      usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Sepolia USDC
    }
  },

  // Mock Li.Fi responses for testing
  MOCK_LIFI_ROUTES: true,
  
  // Testnet faucet amounts
  FAUCET_AMOUNT: 1000, // 1000 testnet USDC
};

export function isTestnetMode(): boolean {
  return process.env.NODE_ENV === 'testnet' || process.env.TESTNET_MODE === 'true';
}

export function getConfig() {
  if (isTestnetMode()) {
    return {
      HL_BASE_URL: TESTNET_CONFIG.HL_BASE_URL,
      HYPEREVM_RPC_URL: TESTNET_CONFIG.HYPEREVM_RPC_URL,
      SOLANA_RPC_URL: TESTNET_CONFIG.CHAINS.solana.rpcUrl,
      BASE_RPC_URL: TESTNET_CONFIG.CHAINS.base.rpcUrl,
      USDC_ADDRESSES: {
        solana: TESTNET_CONFIG.CHAINS.solana.usdcAddress,
        base: TESTNET_CONFIG.CHAINS.base.usdcAddress,
      }
    };
  }
  
  // Production config
  return {
    HL_BASE_URL: process.env.HL_BASE_URL || 'https://api.hyperliquid.xyz',
    HYPEREVM_RPC_URL: process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm',
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    BASE_RPC_URL: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    USDC_ADDRESSES: {
      solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    }
  };
}
