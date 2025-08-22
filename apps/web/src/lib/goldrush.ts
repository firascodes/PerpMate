import { GoldRushClient } from "@covalenthq/client-sdk";

// GoldRush API client for HyperEVM integration
class GoldrushService {
  private client: GoldRushClient;
  private chainName = "eth-mainnet"; // Temporarily using eth-mainnet until HyperEVM is available

  constructor(apiKey?: string) {
    // Use environment variable or provided API key
    const key = apiKey || process.env.GOLDRUSH_API_KEY;
    if (!key) {
      throw new Error("GoldRush API key is required");
    }
    this.client = new GoldRushClient(key);
  }

  /**
   * Get token balances for a wallet address
   */
  async getTokenBalances(walletAddress: string) {
    try {
      // Temporarily disabled - need to fix Chain type compatibility
      console.warn("GoldRush service temporarily disabled");
      return { items: [] };
    } catch (error) {
      console.error("Failed to fetch token balances:", error);
      throw error;
    }
  }

  /**
   * Get transaction history for a wallet address
   */
  async getTransactionHistory(walletAddress: string, page?: number, pageSize?: number) {
    try {
      // Temporarily disabled - need to fix Chain type compatibility
      console.warn("GoldRush service temporarily disabled");
      return { items: [] };
    } catch (error) {
      console.error("Failed to fetch transaction history:", error);
      throw error;
    }
  }

  /**
   * Get historical token prices for analytics
   */
  async getHistoricalTokenPrices(contractAddress: string, from?: string, to?: string) {
    try {
      // Temporarily disabled - need to fix Chain type compatibility
      console.warn("GoldRush service temporarily disabled");
      return { items: [] };
    } catch (error) {
      console.error("Failed to fetch historical prices:", error);
      throw error;
    }
  }

  /**
   * Get decoded log events for a wallet (useful for tracking position changes)
   */
  async getLogEvents(walletAddress: string, startingBlock?: number, endingBlock?: number) {
    try {
      // Temporarily disabled - need to fix Chain type compatibility
      console.warn("GoldRush service temporarily disabled");
      return { items: [] };
    } catch (error) {
      console.error("Failed to fetch log events:", error);
      throw error;
    }
  }

  /**
   * Enhanced position analytics by combining token balances with price data
   */
  async getEnhancedPositionAnalytics(walletAddress: string) {
    try {
      // Temporarily disabled - need to fix Chain type compatibility
      console.warn("GoldRush service temporarily disabled");
      return {
        balances: [],
        recentTransactions: [],
        totalPortfolioValue: 0,
      };
    } catch (error) {
      console.error("Failed to get enhanced analytics:", error);
      throw error;
    }
  }

  /**
   * Get market data for portfolio tracking
   */
  async getMarketData(tokenAddresses: string[]) {
    try {
      // Temporarily disabled - need to fix Chain type compatibility
      console.warn("GoldRush service temporarily disabled");
      return [];
    } catch (error) {
      console.error("Failed to fetch market data:", error);
      throw error;
    }
  }
}

// Singleton instance
let goldrushInstance: GoldrushService | null = null;

export const getGoldrushClient = (apiKey?: string): GoldrushService => {
  if (!goldrushInstance) {
    goldrushInstance = new GoldrushService(apiKey);
  }
  return goldrushInstance;
};

export { GoldrushService };

// Types for better TypeScript support
export interface TokenBalance {
  contract_decimals: number;
  contract_name: string;
  contract_ticker_symbol: string;
  contract_address: string;
  balance: string;
  quote: string;
  quote_rate: string;
}

export interface Transaction {
  block_signed_at: string;
  tx_hash: string;
  from_address: string;
  to_address: string;
  value: string;
  gas_price: string;
  gas_spent: string;
  successful: boolean;
}

export interface EnhancedPositionAnalytics {
  balances: TokenBalance[];
  recentTransactions: Transaction[];
  totalPortfolioValue: number;
}