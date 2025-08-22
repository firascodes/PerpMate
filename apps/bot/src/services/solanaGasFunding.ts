import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  SystemProgram, 
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { logger } from '../logger';

// SOL gas funding configuration
const GAS_FUNDING_CONFIG = {
  // Amount of SOL to fund new wallets (0.01 SOL = ~$0.50)
  FUNDING_AMOUNT_SOL: 0.01,
  // RPC endpoint for Solana mainnet
  RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  // Master wallet private key for funding (should be in env)
  MASTER_WALLET_PRIVATE_KEY: process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY,
  // Minimum balance threshold to trigger funding (in SOL)
  MIN_BALANCE_THRESHOLD: 0.005,
  // Maximum funding attempts per wallet
  MAX_FUNDING_ATTEMPTS: 3
};

// Track funding attempts to prevent spam
const fundingAttempts = new Map<string, number>();
const lastFundingAttempt = new Map<string, number>();

/**
 * Get Solana connection
 */
function getSolanaConnection(): Connection {
  return new Connection(GAS_FUNDING_CONFIG.RPC_URL, 'confirmed');
}

/**
 * Get master wallet keypair for funding operations
 */
function getMasterWallet(): Keypair | null {
  try {
    const privateKeyString = GAS_FUNDING_CONFIG.MASTER_WALLET_PRIVATE_KEY;
    if (!privateKeyString) {
      logger.warn('SOLANA_MASTER_WALLET_PRIVATE_KEY not configured - SOL gas funding disabled');
      return null;
    }

    // Parse private key from base58 string or JSON array
    let privateKeyBytes: number[];
    
    if (privateKeyString.startsWith('[')) {
      // JSON array format: [1,2,3,4,...]
      privateKeyBytes = JSON.parse(privateKeyString);
    } else {
      // Assume base58 string format
      const bs58 = require('bs58');
      privateKeyBytes = Array.from(bs58.decode(privateKeyString));
    }

    if (privateKeyBytes.length !== 64) {
      throw new Error('Invalid private key length');
    }

    return Keypair.fromSecretKey(new Uint8Array(privateKeyBytes));
    
  } catch (error) {
    logger.error({ error }, 'Failed to load master wallet for SOL gas funding');
    return null;
  }
}

/**
 * Get SOL balance for a wallet address
 */
export async function getSolBalance(walletAddress: string): Promise<number> {
  try {
    const connection = getSolanaConnection();
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    logger.error({ error, walletAddress }, 'Failed to get SOL balance');
    return 0;
  }
}

/**
 * Check if wallet needs SOL gas funding
 */
export async function needsGasFunding(walletAddress: string): Promise<boolean> {
  try {
    const balance = await getSolBalance(walletAddress);
    const needsFunding = balance < GAS_FUNDING_CONFIG.MIN_BALANCE_THRESHOLD;
    
    logger.info({ 
      walletAddress: walletAddress.slice(0, 8) + '...', 
      balance, 
      threshold: GAS_FUNDING_CONFIG.MIN_BALANCE_THRESHOLD,
      needsFunding 
    }, 'Checked SOL balance for gas funding');
    
    return needsFunding;
  } catch (error) {
    logger.error({ error, walletAddress }, 'Failed to check if wallet needs gas funding');
    return false;
  }
}

/**
 * Fund a Solana wallet with gas (SOL)
 */
export async function fundSolanaWalletGas(walletAddress: string): Promise<boolean> {
  try {
    // Check if funding is needed
    const needsFunding = await needsGasFunding(walletAddress);
    if (!needsFunding) {
      logger.info({ walletAddress: walletAddress.slice(0, 8) + '...' }, 'Wallet has sufficient SOL balance');
      return true;
    }

    // Check funding rate limits
    const attempts = fundingAttempts.get(walletAddress) || 0;
    const lastAttempt = lastFundingAttempt.get(walletAddress) || 0;
    const timeSinceLastAttempt = Date.now() - lastAttempt;
    const oneHour = 60 * 60 * 1000;

    if (attempts >= GAS_FUNDING_CONFIG.MAX_FUNDING_ATTEMPTS) {
      logger.warn({ walletAddress: walletAddress.slice(0, 8) + '...', attempts }, 'Maximum funding attempts reached');
      return false;
    }

    if (timeSinceLastAttempt < oneHour) {
      logger.warn({ 
        walletAddress: walletAddress.slice(0, 8) + '...', 
        timeSinceLastAttempt,
        oneHour 
      }, 'Rate limit: too soon since last funding attempt');
      return false;
    }

    // Get master wallet
    const masterWallet = getMasterWallet();
    if (!masterWallet) {
      logger.error('Master wallet not available for SOL gas funding');
      return false;
    }

    // Check master wallet balance
    const connection = getSolanaConnection();
    const masterBalance = await connection.getBalance(masterWallet.publicKey);
    const masterBalanceSOL = masterBalance / LAMPORTS_PER_SOL;
    
    if (masterBalanceSOL < GAS_FUNDING_CONFIG.FUNDING_AMOUNT_SOL + 0.001) { // +0.001 for tx fee
      logger.error({ 
        masterBalance: masterBalanceSOL, 
        requiredAmount: GAS_FUNDING_CONFIG.FUNDING_AMOUNT_SOL 
      }, 'Master wallet has insufficient SOL for funding');
      return false;
    }

    // Create funding transaction
    const recipientPublicKey = new PublicKey(walletAddress);
    const fundingAmountLamports = GAS_FUNDING_CONFIG.FUNDING_AMOUNT_SOL * LAMPORTS_PER_SOL;

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: masterWallet.publicKey,
        toPubkey: recipientPublicKey,
        lamports: fundingAmountLamports
      })
    );

    // Send transaction
    logger.info({ 
      walletAddress: walletAddress.slice(0, 8) + '...',
      fundingAmount: GAS_FUNDING_CONFIG.FUNDING_AMOUNT_SOL,
      masterWalletBalance: masterBalanceSOL
    }, 'Sending SOL gas funding transaction');

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [masterWallet],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );

    // Update rate limiting trackers
    fundingAttempts.set(walletAddress, attempts + 1);
    lastFundingAttempt.set(walletAddress, Date.now());

    logger.info({ 
      walletAddress: walletAddress.slice(0, 8) + '...',
      signature,
      fundingAmount: GAS_FUNDING_CONFIG.FUNDING_AMOUNT_SOL
    }, 'Successfully funded Solana wallet with gas');

    return true;

  } catch (error) {
    logger.error({ error, walletAddress: walletAddress.slice(0, 8) + '...' }, 'Failed to fund Solana wallet with gas');
    
    // Update rate limiting even on failure to prevent spam
    const attempts = fundingAttempts.get(walletAddress) || 0;
    fundingAttempts.set(walletAddress, attempts + 1);
    lastFundingAttempt.set(walletAddress, Date.now());
    
    return false;
  }
}

/**
 * Auto-fund SOL gas when a new Solana wallet is created
 */
export async function autoFundNewSolanaWallet(walletAddress: string): Promise<void> {
  try {
    logger.info({ walletAddress: walletAddress.slice(0, 8) + '...' }, 'Auto-funding new Solana wallet with gas');
    
    // Small delay to ensure wallet is fully created
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const success = await fundSolanaWalletGas(walletAddress);
    
    if (success) {
      logger.info({ walletAddress: walletAddress.slice(0, 8) + '...' }, 'Successfully auto-funded new Solana wallet');
    } else {
      logger.warn({ walletAddress: walletAddress.slice(0, 8) + '...' }, 'Auto-funding failed for new Solana wallet');
    }
    
  } catch (error) {
    logger.error({ error, walletAddress: walletAddress.slice(0, 8) + '...' }, 'Error during auto-funding of new Solana wallet');
  }
}

/**
 * Get gas funding statistics
 */
export function getGasFundingStats(): any {
  const totalWalletsFunded = fundingAttempts.size;
  const recentFundings = Array.from(lastFundingAttempt.entries())
    .filter(([, timestamp]) => Date.now() - timestamp < 24 * 60 * 60 * 1000) // Last 24 hours
    .length;

  return {
    totalWalletsFunded,
    recentFundings,
    fundingAmountSOL: GAS_FUNDING_CONFIG.FUNDING_AMOUNT_SOL,
    minBalanceThreshold: GAS_FUNDING_CONFIG.MIN_BALANCE_THRESHOLD,
    maxAttemptsPerWallet: GAS_FUNDING_CONFIG.MAX_FUNDING_ATTEMPTS
  };
}

/**
 * Reset funding attempts for a wallet (admin function)
 */
export function resetFundingAttempts(walletAddress: string): void {
  fundingAttempts.delete(walletAddress);
  lastFundingAttempt.delete(walletAddress);
  logger.info({ walletAddress: walletAddress.slice(0, 8) + '...' }, 'Reset funding attempts for wallet');
}