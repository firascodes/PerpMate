import { logger } from '../logger';
import { USDC_ADDRESSES, SupportedChain } from './deposits';
import { getConfig, isTestnetMode } from '../config/testnet';
import { ethers } from 'ethers';

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
    const config = getConfig();

    // Build candidate RPC/mint pairs and run in parallel
    const candidates: Array<{ rpc: string; mint: string; label: string }> = [];
    const pushUnique = (rpc: string, mint: string, label: string) => {
      const exists = candidates.some((c) => c.rpc === rpc && c.mint === mint);
      if (!exists) candidates.push({ rpc, mint, label });
    };
    pushUnique(config.SOLANA_RPC_URL, config.USDC_ADDRESSES.solana, 'configured');
    pushUnique('https://api.devnet.solana.com', 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', 'devnet');
    pushUnique('https://api.mainnet-beta.solana.com', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'mainnet');

    const tokenProgramId = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

    const queryOne = async (rpcUrl: string, usdcMint: string) => {
      // Try by mint
      const byMintRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [walletAddress, { mint: usdcMint }, { encoding: 'jsonParsed' }],
        }),
      });
      let data = await byMintRes.json();

      // Fallback by programId if mint query errors
      if (data?.error) {
        const byProgramRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTokenAccountsByOwner',
            params: [walletAddress, { programId: tokenProgramId }, { encoding: 'jsonParsed' }],
          }),
        });
        data = await byProgramRes.json();
      }

      const tokenAccounts = data?.result?.value || [];
      let total = 0;
      for (const account of tokenAccounts) {
        const parsed = account.account?.data?.parsed?.info;
        const mint: string | undefined = parsed?.mint;
        if (mint !== usdcMint) continue;
        total += parsed?.tokenAmount?.uiAmount || 0;
      }

      // Fallback: if zero, try if wallet is the token account
      if (total === 0) {
        try {
          const accountInfoRes = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'getAccountInfo',
              params: [walletAddress, { encoding: 'jsonParsed' }],
            }),
          });
          const acc = await accountInfoRes.json();
          const parsed = acc?.result?.value?.data?.parsed;
          const info = parsed?.info;
          if (info?.mint === usdcMint) {
            total = info?.tokenAmount?.uiAmount || 0;
          }
        } catch {}
      }

      return total;
    };

    const results = await Promise.allSettled(
      candidates.map((c) => queryOne(c.rpc, c.mint))
    );

    let best = 0;
    for (const r of results) {
      if (r.status === 'fulfilled') best = Math.max(best, Number(r.value || 0));
    }

    logger.info({ walletAddress, totalBalance: best }, 'Solana USDC balance checked');
    return best;

  } catch (error) {
    logger.error(
      {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error,
        walletAddress,
      },
      'Failed to check Solana USDC balance'
    );
    return 0;
  }
}

/**
 * Get USDC balance on Base using RPC calls
 */
async function getBaseUSDCBalance(walletAddress: string): Promise<number> {
  try {
    const config = getConfig();
    const provider = new ethers.JsonRpcProvider(config.BASE_RPC_URL);

    const erc20Abi = ['function balanceOf(address owner) view returns (uint256)'];
    const baseMainnetUSDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const baseSepoliaUSDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

    const candidates = Array.from(
      new Set([
        config.USDC_ADDRESSES.base,
        baseMainnetUSDC,
        baseSepoliaUSDC,
      ].map((a) => a.toLowerCase()))
    ).map((lc) => [lc, [config.USDC_ADDRESSES.base, baseMainnetUSDC, baseSepoliaUSDC].find((a) => a.toLowerCase() === lc)!][1]);

    for (const candidate of candidates) {
      try {
        const code = await provider.getCode(candidate);
        if (!code || code === '0x') continue;
        const contract = new ethers.Contract(candidate, erc20Abi, provider);
        const balanceWei: bigint = await contract.balanceOf(walletAddress);
        const balance = Number(balanceWei) / 1e6;
        logger.info({ walletAddress, balance, contract: candidate }, 'Base USDC balance checked');
        return balance;
      } catch (innerError) {
        continue;
      }
    }

    logger.warn({ walletAddress, candidates }, 'Unable to query Base USDC balance');
    return 0;
  } catch (error) {
    logger.error(
      {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error,
        walletAddress,
      },
      'Failed to check Base USDC balance'
    );
    return 0;
  }
}

/**
 * Create a balance monitoring key for tracking
 */
export function createBalanceKey(walletAddress: string, chain: SupportedChain): string {
  return `${walletAddress}-${chain}`;
}
