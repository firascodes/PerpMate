export type OrderParams = {
  asset: string;
  side: 'LONG' | 'SHORT';
  notionalUsd: number;
  leverage: number;
};

export async function placeMarketOrder(_params: OrderParams) {
  // Placeholder: implement HL exchange order with Privy signer
  return { orderId: 'stub-order', status: 'accepted' };
}

export async function fetchPositions(_walletAddress: string) {
  // Placeholder: call HL info endpoints
  return [] as Array<{
    asset: string;
    side: 'LONG' | 'SHORT';
    size: number;
    entryPrice: number;
    pnlUnreal: number;
  }>;
}
