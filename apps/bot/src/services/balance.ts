import { logger } from '../logger';
import { USDC_ADDRESSES, SupportedChain } from './deposits';
import { getConfig, isTestnetMode } from '../config/testnet';

// In-memory testnet balance storage (for demo)
const testnetBalances = new Map<string, number>();

// For now, we'll use fetch to call Solana RPC directly
// In production, you should install @solana/web3.js @solana/spl-token for better reliability

/**
 * Check USDC balance for a wallet on a specific chain
 */
export async function getUSDCBalance(walletAddress: string, chain: SupportedChain): Promise<number> {
  try {
    // In testnet mode, use mock balances
    if (isTestnetMode()) {
      const key = `${walletAddress}-${chain}`;
      return testnetBalances.get(key) || 0;
    }

    if (chain === 'solana') {
      return await getSolanaUSDCBalance(walletAddress);
    } else if (chain === 'base') {
      return await getBaseUSDCBalance(walletAddress);
    }
    
    throw new Error(`Unsupported chain: ${chain}`);
  } catch (error) {
    logger.error({ error, walletAddress, chain }, 'Failed to get USDC balance');
    return 0;
  }
}

/**
 * Set testnet balance (for faucet and testing)
 */
export function setTestnetBalance(walletAddress: string, chain: SupportedChain, amount: number): void {
  if (!isTestnetMode()) {
    throw new Error('Setting testnet balance only allowed in testnet mode');
  }
  
  const key = `${walletAddress}-${chain}`;
  testnetBalances.set(key, amount);
  logger.info({ walletAddress, chain, amount }, 'Testnet balance updated');
}

/**
 * Add to testnet balance (for simulating deposits)
 */
export function addTestnetBalance(walletAddress: string, chain: SupportedChain, amount: number): number {
  if (!isTestnetMode()) {
    throw new Error('Adding testnet balance only allowed in testnet mode');
  }
  
  const key = `${walletAddress}-${chain}`;
  const currentBalance = testnetBalances.get(key) || 0;
  const newBalance = currentBalance + amount;
  testnetBalances.set(key, newBalance);
  
  logger.info({ walletAddress, chain, amount, newBalance }, 'Testnet balance increased');
  return newBalance;
}

/**
 * Get USDC balance on Solana using RPC calls
 */
async function getSolanaUSDCBalance(walletAddress: string): Promise<number> {
  try {
    const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const USDC_MINT = USDC_ADDRESSES.solana; // EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
    
    // Get token accounts by owner
    const response = await fetch(SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          { mint: USDC_MINT },
          { encoding: 'jsonParsed' }
        ]
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      logger.warn({ error: data.error, walletAddress }, 'Solana RPC error');
      return 0;
    }
    
    const tokenAccounts = data.result?.value || [];
    if (tokenAccounts.length === 0) {
      // No USDC token account exists yet
      return 0;
    }
    
    // Sum balances from all USDC token accounts
    let totalBalance = 0;
    for (const account of tokenAccounts) {
      const balance = account.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0;
      totalBalance += balance;
    }
    
    logger.info({ walletAddress, totalBalance, accounts: tokenAccounts.length }, 'Solana USDC balance checked');
    return totalBalance;
    
  } catch (error) {
    logger.error({ error, walletAddress }, 'Failed to check Solana USDC balance');
    return 0;
  }
}

/**
 * Get USDC balance on Base using RPC calls
 */
async function getBaseUSDCBalance(walletAddress: string): Promise<number> {
  try {
    const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
    const USDC_CONTRACT = USDC_ADDRESSES.base; // 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    
    // ERC-20 balanceOf function signature
    const balanceOfSignature = '0x70a08231'; // balanceOf(address)
    const paddedAddress = walletAddress.slice(2).padStart(64, '0'); // Remove 0x and pad to 32 bytes
    
    const response = await fetch(BASE_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          {
            to: USDC_CONTRACT,
            data: balanceOfSignature + paddedAddress
          },
          'latest'
        ]
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      logger.warn({ error: data.error, walletAddress }, 'Base RPC error');
      return 0;
    }
    
    const balanceHex = data.result || '0x0';
    const balanceWei = BigInt(balanceHex);
    
    // USDC has 6 decimals
    const balance = Number(balanceWei) / 1e6;
    
    logger.info({ walletAddress, balance }, 'Base USDC balance checked');
    return balance;
    
  } catch (error) {
    logger.error({ error, walletAddress }, 'Failed to check Base USDC balance');
    return 0;
  }
}

/**
 * Create a balance monitoring key for tracking
 */
export function createBalanceKey(walletAddress: string, chain: SupportedChain): string {
  return `${walletAddress}-${chain}`;
}
