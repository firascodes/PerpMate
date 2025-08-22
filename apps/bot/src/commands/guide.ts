import { Context } from 'grammy';
import { getUserByTelegramId } from '../db/users';
import { getUSDCBalance } from '../services/balance';
import { logger } from '../logger';

/**
 * Guide users on next steps based on their current state
 */
export async function suggestNextSteps(telegramId: string): Promise<string> {
  try {
    const user = await getUserByTelegramId(telegramId);
    
    if (!user) {
      return `👋 *Welcome to PerpMate!*

🚀 *Get Started:*
1. Use \`/start\` to create your account
2. Use \`/wallet\` to see your wallet addresses
3. Use \`/fund\` to deposit USDC
4. Start trading with natural language!

Example: "buy 50 btc"`;
    }

    // Check if wallets exist
    if (!user.evmWalletAddress && !user.solanaWalletAddress) {
      return `🔧 *Setup Required*

Your wallets aren't ready yet. Please use:
• \`/wallet\` - Create your multi-chain wallets
• \`/fund\` - Deposit USDC to start trading`;
    }

    // Check balances
    let totalBalance = 0;
    
    if (user.solanaWalletAddress) {
      const solBalance = await getUSDCBalance(user.solanaWalletAddress, 'solana');
      totalBalance += solBalance;
    }
    
    if (user.evmWalletAddress) {
      const evmBalance = await getUSDCBalance(user.evmWalletAddress, 'base');
      totalBalance += evmBalance;
    }

    if (totalBalance < 1) {
      const isTestnet = process.env.TESTNET_MODE === 'true' || process.env.NODE_ENV === 'testnet';
      
      return `💰 *Fund Your Account*

You need USDC to start trading!

${isTestnet ? '🧪 *Testnet Mode:*\n• Use `/faucet` to get free testnet USDC\n\n' : ''}💳 *Fund your account:*
• Use \`/fund\` to deposit from Solana or Base
• Minimum recommended: $20-50 USDC

📊 *Then start trading:*
• "buy 20 btc"
• "long eth with 2x leverage"
• \`/execute BTC buy 50\``;
    }

    // User has balance, they're ready to trade
    return `🎯 *Ready to Trade!*

💰 *Balance:* $${totalBalance.toFixed(2)} USDC

🤖 *Natural Language Trading:*
• "buy 50 btc"
• "short eth with 3x leverage"
• "long 100 sol"

📋 *Commands:*
• \`/balance\` - Check your funds
• \`/active\` - View open positions
• \`/help\` - See all commands

*Just type what you want to trade!*`;

  } catch (error) {
    logger.error({ error, telegramId }, 'Failed to generate user guidance');
    return `❌ *Something went wrong*

Please try using \`/help\` to see available commands.`;
  }
}
