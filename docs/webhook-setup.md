# Webhook Setup Guide

This guide explains how to set up real-time deposit detection using Alchemy (Base) and Helius (Solana) webhooks.

## Why Webhooks Over Polling?

- **Real-time**: Instant notifications when deposits occur (vs 10-second polling)
- **Efficient**: No constant RPC calls eating up rate limits
- **Reliable**: Provider guarantees delivery with retry mechanisms
- **Cost-effective**: Reduces infrastructure costs

## 1. Alchemy Setup (Base Chain)

### Step 1: Create Alchemy Account

1. Go to [Alchemy.com](https://alchemy.com)
2. Sign up and create a new app
3. Select **Base Mainnet** as the network

### Step 2: Create Address Activity Webhook

1. In Alchemy dashboard, go to **Webhooks**
2. Click **Create Webhook**
3. Select **Address Activity**
4. Configure:
   - **Webhook URL**: `https://your-bot-domain.com/webhooks/alchemy`
   - **Addresses**: Add all user wallet addresses (we'll need to update this dynamically)
   - **Filter**: Token transfers only
   - **Token Addresses**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC on Base)

### Step 3: Dynamic Address Management

Since we create wallets dynamically, we need to add addresses to webhooks:

```typescript
// Add this to your Privy service when creating wallets
async function addWalletToWebhook(walletAddress: string) {
  const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN;
  const WEBHOOK_ID = process.env.ALCHEMY_WEBHOOK_ID;

  await fetch(`https://dashboard.alchemy.com/api/update-webhook-addresses`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ALCHEMY_AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      webhook_id: WEBHOOK_ID,
      addresses_to_add: [walletAddress],
      addresses_to_remove: [],
    }),
  });
}
```

## 2. Helius Setup (Solana Chain)

### Step 1: Create Helius Account

1. Go to [Helius.xyz](https://helius.xyz)
2. Sign up and get API key
3. Create webhook in dashboard

### Step 2: Create Webhook

1. Go to **Webhooks** in Helius dashboard
2. Create webhook with:
   - **Webhook URL**: `https://your-bot-domain.com/webhooks/helius`
   - **Transaction Types**:
     - Token transfers
     - Account changes
   - **Accounts**: Add user wallet addresses (dynamic updates needed)

### Step 3: Webhook Configuration

```json
{
  "webhookURL": "https://your-bot-domain.com/webhooks/helius",
  "transactionTypes": ["Any"],
  "accountAddresses": [], // Add dynamically
  "webhookType": "enhanced"
}
```

## 3. Environment Variables

Add these to your `.env`:

```bash
# Alchemy (Base)
ALCHEMY_API_KEY=your_alchemy_api_key
ALCHEMY_AUTH_TOKEN=your_alchemy_auth_token
ALCHEMY_WEBHOOK_ID=your_webhook_id

# Helius (Solana)
HELIUS_API_KEY=your_helius_api_key
HELIUS_WEBHOOK_ID=your_webhook_id

# Bot webhook URLs (for development)
BOT_WEBHOOK_BASE_URL=https://your-bot-domain.com
```

## 4. Testing Webhooks

### Test Alchemy Webhook

```bash
curl -X POST https://your-bot-domain.com/webhooks/alchemy \
  -H "Content-Type: application/json" \
  -d '{
    "webhookId": "test",
    "id": "test",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "type": "ADDRESS_ACTIVITY",
    "event": {
      "network": "BASE_MAINNET",
      "activity": [{
        "fromAddress": "0x...",
        "toAddress": "your_test_wallet",
        "hash": "0x...",
        "value": 1.0,
        "category": "token",
        "rawContract": {
          "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "value": "1000000",
          "decimal": 6
        }
      }]
    }
  }'
```

### Test Helius Webhook

```bash
curl -X POST https://your-bot-domain.com/webhooks/helius \
  -H "Content-Type: application/json" \
  -d '{
    "accountData": [{
      "account": "your_test_wallet",
      "tokenBalanceChanges": [{
        "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "rawTokenAmount": {
          "tokenAmount": "1000000",
          "decimals": 6
        },
        "userAccount": "your_test_wallet"
      }]
    }],
    "signature": "test_signature",
    "timestamp": 1640995200,
    "type": "TRANSFER"
  }'
```

## 5. Webhook Security

### Verify Webhook Signatures

Add signature verification to prevent spoofed webhooks:

```typescript
function verifyAlchemySignature(body: string, signature: string): boolean {
  const crypto = require("crypto");
  const secret = process.env.ALCHEMY_WEBHOOK_SECRET;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return signature === expectedSignature;
}
```

## 6. Fallback Strategy

Keep the polling mechanism as a fallback:

```typescript
// In monitoring.ts - hybrid approach
export function startHybridMonitoring() {
  // Primary: Webhooks handle most deposits
  setupWebhookRoutes(app, bot);

  // Fallback: Poll every 60 seconds for missed deposits
  setInterval(async () => {
    await pollForMissedDeposits();
  }, 60000);
}
```

## 7. Dynamic Wallet Registration

Update your wallet creation service:

```typescript
// In privy.ts
export async function getOrCreateUserWallet(
  telegramId: string,
  chainType: "ethereum" | "solana" = "ethereum"
): Promise<WalletRecord> {
  // ... existing wallet creation code ...

  if (address && isNewWallet) {
    // Register wallet with appropriate webhook service
    if (chainType === "ethereum") {
      await addWalletToAlchemyWebhook(address);
    } else {
      await addWalletToHeliusWebhook(address);
    }
  }

  return wallet;
}
```

This setup provides instant deposit detection with webhook providers handling the heavy lifting of blockchain monitoring.
