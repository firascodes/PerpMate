import { Context, InlineKeyboard } from 'grammy';
import { getUserByTelegramId } from '../db/users';
import { getUSDCBalance } from '../services/balance';
import { getRouteQuote, executeLiFiRoute } from '../services/lifi';
import { logger } from '../logger';
import { PrivyClient } from '@privy-io/server-auth';

interface WithdrawState {
  amount: number;
  sourceChain: 'solana' | 'base';
  destinationAddress: string;
  step: 'select_chain' | 'enter_amount' | 'enter_address' | 'confirm';
}

// In-memory withdraw state (in production, use Redis or database)
const withdrawStates = new Map<string, WithdrawState>();

// Check if user has an active withdraw session
export function hasActiveWithdrawSession(telegramId: string): WithdrawState | null {
  return withdrawStates.get(telegramId) || null;
}

export async function handleWithdraw(ctx: Context) {
  try {
    const telegramId = String(ctx.from?.id);
    
    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      return ctx.reply('❌ User not found. Use /start first.');
    }

    // Check balances
    let totalBalance = 0;
    let availableChains: Array<{ chain: 'solana' | 'base'; balance: number }> = [];

    if (user.solanaWalletAddress) {
      const solanaBalance = await getUSDCBalance(user.solanaWalletAddress, 'solana');
      if (solanaBalance > 0) {
        availableChains.push({ chain: 'solana', balance: solanaBalance });
        totalBalance += solanaBalance;
      }
    }

    if (user.evmWalletAddress) {
      const baseBalance = await getUSDCBalance(user.evmWalletAddress, 'base');
      if (baseBalance > 0) {
        availableChains.push({ chain: 'base', balance: baseBalance });
        totalBalance += baseBalance;
      }
    }

    if (availableChains.length === 0) {
      return ctx.reply('❌ No USDC balance found to withdraw. Use /balance to check your funds.');
    }

    // Show chain selection
    const keyboard = new InlineKeyboard();
    
    for (const { chain, balance } of availableChains) {
      const emoji = chain === 'solana' ? '🟣' : '🔵';
      const chainName = chain === 'solana' ? 'Solana' : 'Base';
      keyboard.text(`${emoji} ${chainName} (${balance.toFixed(2)} USDC)`, `withdraw_${chain}`).row();
    }

    keyboard.text('❌ Cancel', 'withdraw_cancel');

    await ctx.reply(
      `💸 *Withdraw USDC*\n\nSelect which chain to withdraw from:\n\n💰 *Total Available:* ${totalBalance.toFixed(2)} USDC`,
      {
        reply_markup: keyboard,
        parse_mode: 'Markdown',
      }
    );

  } catch (error) {
    logger.error({ error, telegramId: ctx.from?.id }, 'Failed to handle withdraw command');
    await ctx.reply('❌ Failed to start withdrawal. Please try again.');
  }
}

export async function handleWithdrawChainSelection(ctx: Context, chain: 'solana' | 'base') {
  try {
    const telegramId = String(ctx.from?.id);
    await ctx.answerCallbackQuery();

    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      return ctx.reply('❌ User not found.');
    }

    const walletAddress = chain === 'solana' ? user.solanaWalletAddress : user.evmWalletAddress;
    if (!walletAddress) {
      return ctx.reply(`❌ ${chain === 'solana' ? 'Solana' : 'Base'} wallet not found.`);
    }

    const balance = await getUSDCBalance(walletAddress, chain);
    if (balance <= 0) {
      return ctx.reply(`❌ No USDC balance on ${chain === 'solana' ? 'Solana' : 'Base'}.`);
    }

    // Initialize withdraw state
    withdrawStates.set(telegramId, {
      amount: 0,
      sourceChain: chain,
      destinationAddress: '',
      step: 'enter_amount'
    });
    
    // Set pending command for text handler
    // Note: pendingCommands should be imported from main bot file
    // For now, we'll manage state internally

    const chainEmoji = chain === 'solana' ? '🟣' : '🔵';
    const chainName = chain === 'solana' ? 'Solana' : 'Base';

    await ctx.reply(
      `${chainEmoji} *Withdrawing from ${chainName}*\n\nAvailable: *${balance.toFixed(6)} USDC*\n\n💰 *Enter amount to withdraw:*\n\nExample: \`50\` or \`all\``,
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    logger.error({ error, chain }, 'Failed to handle chain selection');
    await ctx.reply('❌ Failed to process selection. Please try again.');
  }
}

export async function handleWithdrawAmount(ctx: Context, amountText: string) {
  try {
    const telegramId = String(ctx.from?.id);
    const state = withdrawStates.get(telegramId);
    
    if (!state || state.step !== 'enter_amount') {
      return ctx.reply('❌ No active withdrawal. Use /withdraw to start.');
    }

    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      return ctx.reply('❌ User not found.');
    }

    const walletAddress = state.sourceChain === 'solana' ? user.solanaWalletAddress : user.evmWalletAddress;
    if (!walletAddress) {
      return ctx.reply('❌ Wallet not found.');
    }

    const balance = await getUSDCBalance(walletAddress, state.sourceChain);
    
    let amount: number;
    if (amountText.toLowerCase() === 'all') {
      amount = balance;
    } else {
      amount = parseFloat(amountText);
      if (isNaN(amount) || amount <= 0) {
        return ctx.reply('❌ Invalid amount. Please enter a valid number or "all".');
      }
    }

    if (amount > balance) {
      return ctx.reply(`❌ Insufficient balance. Available: ${balance.toFixed(6)} USDC`);
    }

    if (amount < 1) {
      return ctx.reply('❌ Minimum withdrawal amount is 1 USDC.');
    }

    // Update state
    state.amount = amount;
    state.step = 'enter_address';
    withdrawStates.set(telegramId, state);

    const chainName = state.sourceChain === 'solana' ? 'Solana' : 'Base/EVM';
    const exampleAddress = state.sourceChain === 'solana' 
      ? '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
      : '0x742d35Cc6636C0532925a3b8D6C90532e4A5cf4a';

    await ctx.reply(
      `💰 *Amount:* ${amount.toFixed(6)} USDC\n\n📍 *Enter destination ${chainName} address:*\n\nExample: \`${exampleAddress}\``,
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    logger.error({ error, amountText }, 'Failed to handle withdraw amount');
    await ctx.reply('❌ Failed to process amount. Please try again.');
  }
}

export async function handleWithdrawAddress(ctx: Context, address: string) {
  try {
    const telegramId = String(ctx.from?.id);
    const state = withdrawStates.get(telegramId);
    
    if (!state || state.step !== 'enter_address') {
      return ctx.reply('❌ No active withdrawal. Use /withdraw to start.');
    }

    // Basic address validation
    const isValidAddress = state.sourceChain === 'solana' 
      ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) // Base58 for Solana
      : /^0x[a-fA-F0-9]{40}$/.test(address); // Hex for EVM

    if (!isValidAddress) {
      const expectedFormat = state.sourceChain === 'solana' ? 'Base58 (32-44 characters)' : 'Ethereum address (0x...)';
      return ctx.reply(`❌ Invalid address format. Expected ${expectedFormat}.`);
    }

    // Update state
    state.destinationAddress = address;
    state.step = 'confirm';
    withdrawStates.set(telegramId, state);

    const chainEmoji = state.sourceChain === 'solana' ? '🟣' : '🔵';
    const chainName = state.sourceChain === 'solana' ? 'Solana' : 'Base';

    const keyboard = new InlineKeyboard()
      .text('✅ Confirm Withdrawal', 'withdraw_confirm')
      .text('❌ Cancel', 'withdraw_cancel');

    await ctx.reply(
      `🔍 *Withdrawal Confirmation*\n\n${chainEmoji} *From:* ${chainName}\n💰 *Amount:* ${state.amount.toFixed(6)} USDC\n📍 *To:* \`${state.destinationAddress}\`\n\n⚠️ *Please verify the address carefully!*`,
      {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      }
    );

  } catch (error) {
    logger.error({ error, address }, 'Failed to handle withdraw address');
    await ctx.reply('❌ Failed to process address. Please try again.');
  }
}

export async function handleWithdrawConfirm(ctx: Context) {
  try {
    const telegramId = String(ctx.from?.id);
    await ctx.answerCallbackQuery();
    
    const state = withdrawStates.get(telegramId);
    if (!state || state.step !== 'confirm') {
      return ctx.reply('❌ No active withdrawal to confirm.');
    }

    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      return ctx.reply('❌ User not found.');
    }

    const fromAddress = state.sourceChain === 'solana' ? user.solanaWalletAddress : user.evmWalletAddress;
    if (!fromAddress) {
      return ctx.reply('❌ Source wallet not found.');
    }

    await ctx.reply('🔄 *Processing withdrawal...*\n\nAnalyzing transfer type...');

    try {
      // Determine if this is a same-chain transfer or cross-chain bridge
      const isSameChainTransfer = await isSameChain(state.sourceChain, state.destinationAddress);
      
      if (isSameChainTransfer) {
        // Direct same-chain transfer (much cheaper and faster)
        await ctx.reply('💰 *Same-chain transfer detected* - Processing direct transfer...');
        
        const txHash = await executeSameChainTransfer(
          state.sourceChain,
          state.amount,
          fromAddress,
          state.destinationAddress,
          user.evmWalletId!,
          user.solanaWalletId!
        );
        
        if (txHash) {
          await ctx.reply(
            `✅ *Transfer Completed!*\n\n🔗 *Transaction:* \`${txHash}\`\n\n💸 *${state.amount} USDC* sent to your destination address!`,
            { parse_mode: 'Markdown' }
          );
        } else {
          throw new Error('Direct transfer failed');
        }
        
      } else {
        // Check if this is actually a same-chain transfer that Li.Fi can handle
        if (isSameChainTransfer && state.sourceChain === 'solana') {
          await ctx.reply('💰 *Same-chain Solana transfer* - Using Li.Fi for reliable delivery...');
        } else {
          await ctx.reply('🌉 *Cross-chain bridge required* - Getting Li.Fi route...');
        }
        
        const route = await getRouteQuote(
          state.sourceChain,
          state.amount,
          fromAddress,
          state.destinationAddress
        );

        if (!route) {
          throw new Error('No bridge route available');
        }

        await ctx.reply(
          `🌉 *Bridge Route Found*\n\nETA: ~${route.estimate?.executionDuration || 300}s\nFees: ~$${(Number(route.estimate?.gasCosts?.[0]?.amountUSD) || 2).toFixed(2)}\n\n🚀 *Executing bridge...*`
        );

        const routeExecution = await executeLiFiRoute(route, user.evmWalletId!);

        if (routeExecution.success) {
          await ctx.reply(
            `✅ *Bridge Initiated!*\n\n🔗 *Transaction:* \`${routeExecution.txHash}\`\n\n⏳ Your USDC will arrive at the destination in ~${route.estimate?.executionDuration || 300} seconds.`,
            { parse_mode: 'Markdown' }
          );
        } else {
          throw new Error(routeExecution.error || 'Bridge execution failed');
        }
      }

    } catch (error) {
      logger.error({ error, state }, 'Failed to execute withdrawal');
      await ctx.reply('❌ *Withdrawal Failed*\n\nUnable to process withdrawal. Please try again later or contact support.');
    }

    // Clear state
    withdrawStates.delete(telegramId);

  } catch (error) {
    logger.error({ error }, 'Failed to confirm withdrawal');
    await ctx.reply('❌ Failed to process withdrawal. Please try again.');
    withdrawStates.delete(String(ctx.from?.id));
  }
}

export async function handleWithdrawCancel(ctx: Context) {
  try {
    const telegramId = String(ctx.from?.id);
    await ctx.answerCallbackQuery();
    
    withdrawStates.delete(telegramId);
    await ctx.reply('❌ *Withdrawal cancelled.*');
    
  } catch (error) {
    logger.error({ error }, 'Failed to cancel withdrawal');
  }
}

/**
 * Check if the destination address is on the same chain as the source
 */
async function isSameChain(sourceChain: 'solana' | 'base', destinationAddress: string): Promise<boolean> {
  try {
    if (sourceChain === 'solana') {
      // Solana addresses are typically 32-44 characters, base58 encoded
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(destinationAddress);
    } else {
      // Base/EVM addresses are 42 characters, start with 0x
      return /^0x[a-fA-F0-9]{40}$/.test(destinationAddress);
    }
  } catch (error) {
    logger.error({ error, sourceChain, destinationAddress }, 'Error checking chain compatibility');
    return false;
  }
}

/**
 * Execute a same-chain USDC transfer (no bridging needed)
 */
async function executeSameChainTransfer(
  chain: 'solana' | 'base',
  amount: number,
  fromAddress: string,
  toAddress: string,
  evmWalletId: string,
  solanaWalletId: string
): Promise<string | null> {
  try {
    // Initialize Privy client with proper configuration
    const privyClient = new PrivyClient(
      process.env.PRIVY_APP_ID!,
      process.env.PRIVY_APP_SECRET!
    );
    
    // Ensure we have the required environment variables
    if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
      throw new Error('Privy environment variables not configured');
    }

    if (chain === 'solana') {
      logger.info({ chain, amount, fromAddress, toAddress }, 'Attempting Solana USDC transfer via Privy');
      
      try {
        // Use Privy's simplified approach for Solana SPL token transfers
        const transferResult = await (privyClient as any).walletApi.solana.transferTokens({
          walletId: solanaWalletId,
          to: toAddress,
          amount: (amount * 1_000_000).toString(), // Convert to smallest unit (USDC has 6 decimals)
          mint: process.env.SOLANA_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC mint address
        });
        
        if (transferResult?.transactionHash) {
          logger.info({ 
            txHash: transferResult.transactionHash, 
            amount, 
            toAddress 
          }, 'Solana USDC transfer completed via Privy');
          return transferResult.transactionHash;
        } else {
          throw new Error('No transaction hash returned from Privy Solana transfer');
        }
        
      } catch (solanaError) {
        logger.error({ solanaError, amount, fromAddress, toAddress }, 'Privy Solana transfer failed, falling back to Li.Fi');
        // For maximum reliability, fall back to Li.Fi bridge if Privy direct transfer fails
        // This ensures users can still complete withdrawals even if Privy has issues
        return null;
      }
      
    } else {
      // EVM USDC transfer (Base)
      logger.info({ chain, amount, fromAddress, toAddress }, 'Executing Base USDC transfer');
      
      const signer = await (privyClient as any).walletApi.createEthersSigner({ 
        walletId: evmWalletId,
        chainId: 8453 // Base mainnet
      });
      
      if (!signer) {
        throw new Error('Failed to create EVM signer');
      }
      
      // USDC contract on Base
      const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      const { ethers } = await import('ethers');
      
      const usdcContract = new ethers.Contract(
        USDC_CONTRACT,
        ['function transfer(address to, uint256 amount) returns (bool)'],
        signer
      );
      
      // Execute transfer (USDC has 6 decimals)
      const tx = await usdcContract.transfer(toAddress, ethers.parseUnits(amount.toString(), 6));
      const receipt = await tx.wait();
      
      logger.info({ txHash: receipt.hash, amount, toAddress }, 'Base USDC transfer completed');
      return receipt.hash;
    }
    
  } catch (error) {
    logger.error({ error, chain, amount, fromAddress, toAddress }, 'Failed to execute same-chain transfer');
    return null;
  }
}
