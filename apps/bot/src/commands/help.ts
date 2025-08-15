import { Context, InlineKeyboard } from 'grammy';

export async function handleHelp(ctx: Context) {
  const kb = new InlineKeyboard()
    .text('💰 Fund', 'help_fund')
    .text('👛 Wallet', 'help_wallet')
    .row()
    .text('💸 Withdraw', 'help_withdraw')
    .text('📊 Active', 'help_active')
    .row()
    .text('💳 Balance', 'help_balance')
    .text('🚰 Faucet', 'help_faucet');

  const isTestnet = process.env.TESTNET_MODE === 'true' || process.env.NODE_ENV === 'testnet';
  const testnetNote = isTestnet ? '\n\n🧪 **TESTNET MODE** - Safe for testing!' : '';

  const msg = `🤖 **PerpMate Bot Help**${testnetNote}

**💼 Account Management:**
• \`/start\` - Create your account & multi-chain wallets
• \`/wallet\` - View your Solana & EVM wallet addresses
• \`/balance\` - Check USDC balances on all chains${isTestnet ? '\n• `/faucet` - Get testnet USDC for testing' : ''}

**💰 Funding & Withdrawals:**
• \`/fund\` - Deposit USDC from Solana/Base to bot
• \`/withdraw\` - Send USDC from bot to external address

**📈 Trading:**
• \`/execute\` - Place a trade (e.g., \`/execute BTC buy 50 3\`)
• \`/active\` - View your open positions & P&L
• \`/preview\` - Preview pending route/trade details

**🤖 Natural Language Trading:**
Just type what you want to trade!
• "buy 100 btc"
• "short eth with 2x leverage" 
• "sell all my solana"
• "long 50 dollars of bitcoin"

**ℹ️ Other:**
• \`/help\` - Show this help menu
• \`/login\` - Get dashboard login link

**Quick Actions:**`;

  await ctx.reply(msg, {
    reply_markup: kb,
    parse_mode: 'Markdown',
  });
}
