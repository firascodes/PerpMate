import { InfoClient, WebSocketTransport } from "@nktkas/hyperliquid";

// Types for WebSocket events
export interface PositionUpdate {
  asset: string;
  szi: string;
  entryPx: string;
  markPx: string;
  unrealizedPnl: string;
  timestamp: number;
}

export interface PortfolioUpdate {
  totalPnl: number;
  totalNotionalValue: number;
  positionCount: number;
  lastUpdated: number;
}

export type WebSocketEventType = 'position_update' | 'portfolio_update' | 'connection_status' | 'error';

export interface WebSocketEvent {
  type: WebSocketEventType;
  data: any;
}

// WebSocket connection manager for real-time position updates
class HyperliquidWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private listeners: Map<string, Set<(event: WebSocketEvent) => void>> = new Map();
  private subscriptions: Set<string> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private readonly RECONNECT_DELAY = 5000; // 5 seconds
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly WS_URL = 'wss://api.hyperliquid.xyz/ws';

  constructor() {
    // Initialize event listeners map
    ['position_update', 'portfolio_update', 'connection_status', 'error'].forEach(type => {
      this.listeners.set(type, new Set());
    });
  }

  // Connect to Hyperliquid WebSocket
  async connect(walletAddress: string): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    
    try {
      this.ws = new WebSocket(this.WS_URL);
      
      this.ws.onopen = () => {
        console.log('Connected to Hyperliquid WebSocket');
        this.isConnecting = false;
        this.emit('connection_status', { connected: true });
        
        // Subscribe to user position updates
        this.subscribeToPositions(walletAddress);
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Clear any reconnection timeout
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          this.emit('error', { error: 'Failed to parse message' });
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        this.isConnecting = false;
        this.emit('connection_status', { connected: false });
        this.stopHeartbeat();
        
        // Attempt to reconnect unless it was a manual close
        if (event.code !== 1000) {
          this.scheduleReconnect(walletAddress);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', { error: 'WebSocket connection error' });
      };

    } catch (error) {
      this.isConnecting = false;
      console.error('Failed to create WebSocket connection:', error);
      this.emit('error', { error: 'Failed to connect' });
      throw error;
    }
  }

  // Subscribe to position updates for a specific wallet
  private subscribeToPositions(walletAddress: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const subscriptionMessage = {
      method: 'subscribe',
      subscription: {
        type: 'userEvents',
        user: walletAddress
      }
    };

    this.ws.send(JSON.stringify(subscriptionMessage));
    this.subscriptions.add(walletAddress);
    console.log('Subscribed to position updates for:', walletAddress);
  }

  // Handle incoming WebSocket messages
  private handleMessage(data: any): void {
    try {
      if (data.channel === 'userEvents') {
        // Handle user events (position updates, trades, etc.)
        if (data.data && data.data.fills) {
          // Process trade fills that affect positions
          this.emit('position_update', {
            fills: data.data.fills,
            timestamp: Date.now()
          });
        }

        if (data.data && data.data.funding) {
          // Process funding payments that affect PnL
          this.emit('portfolio_update', {
            funding: data.data.funding,
            timestamp: Date.now()
          });
        }
      }

      // Handle other message types
      if (data.channel === 'user') {
        this.emit('position_update', {
          ...data.data,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.emit('error', { error: 'Failed to handle message' });
    }
  }

  // Schedule reconnection
  private scheduleReconnect(walletAddress: string): void {
    if (this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      console.log('Attempting to reconnect to WebSocket...');
      this.connect(walletAddress);
    }, this.RECONNECT_DELAY);
  }

  // Start heartbeat to keep connection alive
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'ping' }));
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  // Stop heartbeat
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Add event listener
  on(eventType: WebSocketEventType, callback: (event: WebSocketEvent) => void): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.add(callback);
    }
  }

  // Remove event listener
  off(eventType: WebSocketEventType, callback: (event: WebSocketEvent) => void): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  // Emit event to all listeners
  private emit(eventType: WebSocketEventType, data: any): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const event: WebSocketEvent = { type: eventType, data };
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in WebSocket event listener:', error);
        }
      });
    }
  }

  // Disconnect WebSocket
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }

    this.subscriptions.clear();
    this.isConnecting = false;
  }

  // Get connection status
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // Get subscribed wallets
  get subscribedWallets(): string[] {
    return Array.from(this.subscriptions);
  }
}

// Singleton instance
let wsServiceInstance: HyperliquidWebSocketService | null = null;

export const getWebSocketService = (): HyperliquidWebSocketService => {
  if (!wsServiceInstance) {
    wsServiceInstance = new HyperliquidWebSocketService();
  }
  return wsServiceInstance;
};

// React hook for using WebSocket service
export const useWebSocketService = () => {
  return getWebSocketService();
};

// Helper function to format position updates for UI consumption
export const formatPositionUpdate = (update: any): PositionUpdate | null => {
  try {
    if (!update || !update.asset) {
      return null;
    }

    return {
      asset: update.asset,
      szi: update.szi || '0',
      entryPx: update.entryPx || '0',
      markPx: update.markPx || '0',
      unrealizedPnl: update.unrealizedPnl || '0',
      timestamp: update.timestamp || Date.now()
    };
  } catch (error) {
    console.error('Error formatting position update:', error);
    return null;
  }
};

// Helper function to calculate portfolio metrics from position updates
export const calculatePortfolioMetrics = (positions: PositionUpdate[]): PortfolioUpdate => {
  const totalPnl = positions.reduce((sum, pos) => sum + parseFloat(pos.unrealizedPnl), 0);
  const totalNotionalValue = positions.reduce((sum, pos) => {
    const szi = parseFloat(pos.szi);
    const markPx = parseFloat(pos.markPx);
    return sum + Math.abs(szi) * markPx;
  }, 0);

  return {
    totalPnl,
    totalNotionalValue,
    positionCount: positions.length,
    lastUpdated: Date.now()
  };
};

export { HyperliquidWebSocketService };