import { logger } from '../logger';
import { getOrCreateUserWallet } from './privy';

// USDC token addresses on different chains
export const USDC_ADDRESSES = {
  solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
} as const;

export type SupportedChain = keyof typeof USDC_ADDRESSES;

export interface DepositInfo {
  chain: SupportedChain;
  walletAddress: string;
  tokenAddress: string;
  tokenSymbol: 'USDC';
}

/**
 * Get deposit information for a user's wallet on a specific chain
 */
export async function getDepositInfo(telegramId: string, chain: SupportedChain): Promise<DepositInfo> {
  try {
    logger.info({ telegramId, chain }, 'Getting deposit info');
    
    // Create the appropriate wallet type based on the chain
    const chainType = chain === 'solana' ? 'solana' : 'ethereum';
    const wallet = await getOrCreateUserWallet(telegramId, chainType);
    
    return {
      chain,
      walletAddress: wallet.walletAddress,
      tokenAddress: USDC_ADDRESSES[chain],
      tokenSymbol: 'USDC',
    };
  } catch (error) {
    logger.error({ error, telegramId, chain }, 'Failed to get deposit info');
    throw new Error('Failed to get deposit information');
  }
}

/**
 * Format deposit instructions for Telegram message
 */
export function formatDepositInstructions(depositInfo: DepositInfo): string {
  const { chain, walletAddress, tokenAddress } = depositInfo;
  
  const chainEmoji = chain === 'solana' ? '🟣' : '🔵';
  const chainName = chain === 'solana' ? 'Solana' : 'Base';
  
  return `${chainEmoji} **${chainName} USDC Deposit**

📍 **Your Wallet Address:**
\`${walletAddress}\`

🪙 **Token Contract:**
\`${tokenAddress}\`

⚠️ **Important:**
• Only send USDC to this address
• Send from ${chainName} network only
• I'll automatically detect your deposit ⏳
• Bridge to Hyperliquid happens automatically

💡 **Tip:** Tap to copy addresses above`;
}

/**
 * Create a shortened address for display (first 6 + last 4 chars)
 */
export function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
