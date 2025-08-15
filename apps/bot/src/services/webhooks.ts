import { Request, Response } from 'express';
import { logger } from '../logger';
import { getUSDCBalance } from './balance';
import { SupportedChain, USDC_ADDRESSES } from './deposits';
import { handleDepositDetected, DepositEvent } from './monitoring';
import { Bot } from 'grammy';

interface AlchemyWebhookPayload {
  webhookId: string;
  id: string;
  createdAt: string;
  type: 'ADDRESS_ACTIVITY';
  event: {
    network: 'ETH_MAINNET' | 'BASE_MAINNET' | 'MATIC_MAINNET' | 'ARB_MAINNET';
    activity: Array<{
      fromAddress: string;
      toAddress: string;
      blockNum: string;
      hash: string;
      value: number;
      erc721TokenId?: string;
      erc1155Metadata?: any;
      asset: string;
      category: 'token' | 'external' | 'internal';
      rawContract: {
        address: string;
        value: string;
        decimal: number;
      };
    }>;
  };
}

interface HeliusWebhookPayload {
  accountData: Array<{
    account: string;
    nativeBalanceChange: number;
    tokenBalanceChanges: Array<{
      mint: string;
      rawTokenAmount: {
        tokenAmount: string;
        decimals: number;
      };
      userAccount: string;
    }>;
  }>;
  description: string;
  type: string;
  source: string;
  slot: number;
  timestamp: number;
  signature: string;
}

/**
 * Webhook endpoint for Alchemy (Base chain) deposit notifications
 */
export async function handleAlchemyWebhook(req: Request, res: Response, bot: Bot) {
  try {
    const payload: AlchemyWebhookPayload = req.body;
    logger.info({ webhookId: payload.webhookId, eventType: payload.type }, 'Alchemy webhook received');

    // Verify this is an address activity webhook
    if (payload.type !== 'ADDRESS_ACTIVITY') {
      return res.status(200).json({ status: 'ignored', reason: 'not address activity' });
    }

    // Process each activity in the event
    for (const activity of payload.event.activity) {
      // Check if this is a USDC transfer TO one of our monitored wallets
      if (
        activity.category === 'token' &&
        activity.rawContract.address.toLowerCase() === USDC_ADDRESSES.base.toLowerCase() &&
        activity.value > 0
      ) {
        logger.info({ 
          toAddress: activity.toAddress, 
          amount: activity.value, 
          txHash: activity.hash 
        }, 'USDC deposit detected via Alchemy webhook');

        // Find the telegram user for this wallet
        const telegramId = await findTelegramIdByWallet(activity.toAddress, 'base');
        
        if (telegramId) {
          const deposit: DepositEvent = {
            walletAddress: activity.toAddress,
            chain: 'base',
            amount: activity.value,
            txHash: activity.hash,
            timestamp: new Date(),
          };

          await handleDepositDetected(bot, telegramId, deposit);
        } else {
          logger.warn({ walletAddress: activity.toAddress }, 'Received deposit for untracked wallet');
        }
      }
    }

    res.status(200).json({ status: 'processed' });
  } catch (error) {
    logger.error({ error }, 'Failed to process Alchemy webhook');
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Webhook endpoint for Helius (Solana chain) deposit notifications
 */
export async function handleHeliusWebhook(req: Request, res: Response, bot: Bot) {
  try {
    const payload: HeliusWebhookPayload = req.body;
    logger.info({ signature: payload.signature, type: payload.type }, 'Helius webhook received');

    // Process token balance changes
    for (const accountData of payload.accountData) {
      for (const tokenChange of accountData.tokenBalanceChanges) {
        // Check if this is a USDC deposit (positive balance change)
        if (
          tokenChange.mint === USDC_ADDRESSES.solana &&
          parseFloat(tokenChange.rawTokenAmount.tokenAmount) > 0
        ) {
          const amount = parseFloat(tokenChange.rawTokenAmount.tokenAmount) / Math.pow(10, tokenChange.rawTokenAmount.decimals);
          
          logger.info({ 
            userAccount: tokenChange.userAccount, 
            amount, 
            signature: payload.signature 
          }, 'USDC deposit detected via Helius webhook');

          // Find the telegram user for this wallet
          const telegramId = await findTelegramIdByWallet(tokenChange.userAccount, 'solana');
          
          if (telegramId) {
            const deposit: DepositEvent = {
              walletAddress: tokenChange.userAccount,
              chain: 'solana',
              amount,
              txHash: payload.signature,
              timestamp: new Date(payload.timestamp * 1000),
            };

            await handleDepositDetected(bot, telegramId, deposit);
          } else {
            logger.warn({ walletAddress: tokenChange.userAccount }, 'Received deposit for untracked wallet');
          }
        }
      }
    }

    res.status(200).json({ status: 'processed' });
  } catch (error) {
    logger.error({ error }, 'Failed to process Helius webhook');
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Find telegram ID by wallet address and chain
 */
async function findTelegramIdByWallet(walletAddress: string, chain: SupportedChain): Promise<string | null> {
  try {
    // Import here to avoid circular dependency
    const { prisma } = await import('../db/client');
    
    const searchField = chain === 'solana' ? 'solanaWalletAddress' : 'evmWalletAddress';
    
    const user = await prisma.user.findFirst({
      where: {
        [searchField]: {
          equals: walletAddress,
          mode: 'insensitive'
        }
      }
    });

    return user?.telegramId || null;
  } catch (error) {
    logger.error({ error, walletAddress, chain }, 'Failed to find telegram ID by wallet');
    return null;
  }
}

/**
 * Setup webhook endpoints
 */
export function setupWebhookRoutes(app: any, bot: Bot) {
  // Alchemy webhook for Base chain
  app.post('/webhooks/alchemy', (req: Request, res: Response) => {
    handleAlchemyWebhook(req, res, bot);
  });

  // Helius webhook for Solana chain  
  app.post('/webhooks/helius', (req: Request, res: Response) => {
    handleHeliusWebhook(req, res, bot);
  });

  logger.info('Webhook routes setup complete');
}
