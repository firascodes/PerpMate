# Deployment Guide for PerpMate

## Prerequisites

- Railway account (for bot deployment)
- Vercel account (for dashboard deployment)
- PostgreSQL database (Railway or external)

## Bot Deployment (Railway)

### 1. Environment Variables (Railway)

Set these in your Railway project:

```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
WEB_URL=https://your-vercel-app.vercel.app
DATABASE_URL=postgresql://username:password@hostname:port/database
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
BASE_RPC_URL=https://mainnet.base.org
HL_BASE_URL=https://api.hyperliquid.xyz
HYPEREVM_RPC_URL=https://rpc.hyperliquid.xyz/evm
NODE_ENV=production
TESTNET_MODE=false
GOOGLE_AI_API_KEY=your_google_ai_api_key
```

### 2. Deploy Steps

1. Connect your GitHub repo to Railway
2. Select the PerpMate repository
3. Railway will auto-detect the `railway.toml` configuration
4. Set the environment variables above
5. Deploy!

## Dashboard Deployment (Vercel)

### 1. Environment Variables (Vercel)

Set these in your Vercel project:

```
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_TELEGRAM_BOT_NAME=YourBotName
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
DATABASE_URL=postgresql://username:password@hostname:port/database
NODE_ENV=production
```

### 2. Deploy Steps

1. Connect your GitHub repo to Vercel
2. Select the PerpMate repository
3. Vercel will auto-detect the `vercel.json` configuration
4. Set the environment variables above
5. Deploy!

### 3. Update Bot Configuration

After deploying to Vercel:

1. Copy your Vercel deployment URL (e.g., `https://your-app.vercel.app`)
2. Update the `WEB_URL` environment variable in Railway to point to your Vercel URL
3. Redeploy the bot on Railway

## Database Setup

1. Create a PostgreSQL database (Railway PostgreSQL or external)
2. Run database migrations:
   ```bash
   cd apps/bot
   npx prisma migrate deploy
   ```

## Post-Deployment Checklist

- [ ] Bot responds to `/start` command
- [ ] Dashboard loads at your Vercel URL
- [ ] `/login` command generates working dashboard links
- [ ] `/balance` command shows correct USDC balances
- [ ] `/fund` command provides deposit addresses

## Troubleshooting

- Check Railway logs for bot errors
- Check Vercel function logs for dashboard issues
- Verify all environment variables are set correctly
- Ensure database connection is working
