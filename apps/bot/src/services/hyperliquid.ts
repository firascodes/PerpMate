import { ethers } from 'ethers';
import { PrivyClient } from '@privy-io/server-auth';
import { createEthersSigner } from '@privy-io/server-auth/ethers';
import * as hl from '@nktkas/hyperliquid';
import { logger } from '../logger';

function getPrivySigner() {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  const rpcUrl = process.env.HYPEREVM_RPC_URL;
  if (!appId || !appSecret || !rpcUrl) {
    throw new Error('Missing PRIVY_APP_ID/PRIVY_APP_SECRET/HYPEREVM_RPC_URL');
  }
  const privyClient = new PrivyClient(appId, appSecret);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return { privyClient, provider };
}

export function initHlClients(walletId: string, address: string) {
  const { privyClient, provider } = getPrivySigner();
  // Cast privyClient to any to avoid TS private member mismatch across ESM/CJS builds
  const signer = createEthersSigner({ walletId, address, provider, privyClient: privyClient as any });
  const transport = new hl.HttpTransport();
  const exchange = new hl.ExchangeClient({ transport, wallet: signer as any });
  const info = new hl.InfoClient({ transport });
  return { exchange, info };
}

export async function fetchUniverse(info: hl.InfoClient) {
  const [meta, ctx] = await info.metaAndAssetCtxs();
  return { meta, ctx };
}

export function getAssetIndexBySymbol(meta: any, symbol: string): number {
  const sym = symbol.toUpperCase();
  return meta.universe.findIndex((a: any) => a.name === sym);
}

export async function fetchUserState(info: hl.InfoClient, address: string) {
  return info.clearinghouseState({ user: address } as any);
}

export async function checkUserExists(info: hl.InfoClient, address: string, source: string) {
  try {
    const res = await info.preTransferCheck({ user: address, source } as any);
    return Boolean((res as any)?.userExists);
  } catch (e) {
    logger.warn({ e }, 'preTransferCheck failed');
    return false;
  }
}

export async function placeMarketOrderHL(exchange: hl.ExchangeClient, params: { assetIndex: number; buy: boolean; size: number; }) {
  try {
    // Convert size to string with proper precision
    const sizeStr = params.size.toFixed(6);
    
    const res = await exchange.order({
      orders: [
        {
          a: params.assetIndex,  // asset index
          b: params.buy,         // buy (true) or sell (false)
          p: "0",               // price (0 for market order) - must be string
          s: sizeStr,           // size - must be string
          r: false,             // reduce only
          t: {                  // order type
            limit: {
              tif: "Ioc"        // Immediate or Cancel for market orders
            }
          }
        }
      ],
      grouping: "na"            // no grouping
    });
    
    logger.info({ res, params }, 'HL order placed successfully');
    return res;
  } catch (error) {
    logger.error({ error, params }, 'Failed to place HL order');
    throw error;
  }
}
