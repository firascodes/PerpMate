"use client";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import Cookies from "js-cookie";
import { Button } from "@/components/ui/button";
import { useWebSocketService, formatPositionUpdate, calculatePortfolioMetrics, WebSocketEvent } from "@/lib/websocket";
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, BarChart3, Activity, Target, PieChart, Zap } from "lucide-react";

// Real authentication check using cookies
const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const session = Cookies.get("session");
    if (session) {
      try {
        const userData = JSON.parse(session);
        setUser(userData);
        setIsLoggedIn(true);
      } catch (error) {
        console.error("Failed to parse session cookie:", error);
        setIsLoggedIn(false);
      }
    } else {
      setIsLoggedIn(false);
    }
  }, []);

  return { isLoggedIn, user };
};

interface EnhancedPosition {
  asset: string;
  szi: string;
  entryPx: string;
  markPx: string;
  unrealizedPnl: string;
  realizedPnl?: string;
  leverage?: string;
  margin?: string;
  side: 'long' | 'short';
  pnlPercentage: number;
  notionalValue: number;
  timestamp: number;
}

interface PortfolioAnalytics {
  totalPnl: number;
  totalNotionalValue: number;
  positionCount: number;
  profitablePositions: number;
  winRate: number;
  averagePnlPercentage: number;
  lastUpdated: number;
  goldrush?: any;
}

export default function Dashboard() {
  const { isLoggedIn, user } = useAuth();
  const [positions, setPositions] = useState<EnhancedPosition[]>([]);
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const wsService = useWebSocketService();

  // Fetch positions function
  const fetchPositions = useCallback(async () => {
    if (!isLoggedIn) return;
    
    try {
      const res = await fetch("/api/positions");
      if (res.ok) {
        const data = await res.json();
        setPositions(data.positions || []);
        setAnalytics(data.analytics || null);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error("Failed to fetch positions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  // Initial load
  useEffect(() => {
    if (isLoggedIn) {
      fetchPositions();
    } else {
      setIsLoading(false);
    }
  }, [isLoggedIn, fetchPositions]);

  // WebSocket setup for real-time updates
  useEffect(() => {
    if (isLoggedIn && user && (user as any).evmWalletAddress) {
      const walletAddress = (user as any).evmWalletAddress;
      
      // Connect to WebSocket
      wsService.connect(walletAddress).catch(console.error);
      
      // Listen for connection status
      const handleConnectionStatus = (event: WebSocketEvent) => {
        setIsConnected(event.data.connected);
      };

      // Listen for position updates
      const handlePositionUpdate = (event: WebSocketEvent) => {
        console.log('Position update received:', event.data);
        // Refresh positions when we get updates
        fetchPositions();
      };

      // Listen for portfolio updates
      const handlePortfolioUpdate = (event: WebSocketEvent) => {
        console.log('Portfolio update received:', event.data);
        fetchPositions();
      };

      wsService.on('connection_status', handleConnectionStatus);
      wsService.on('position_update', handlePositionUpdate);
      wsService.on('portfolio_update', handlePortfolioUpdate);

      return () => {
        wsService.off('connection_status', handleConnectionStatus);
        wsService.off('position_update', handlePositionUpdate);
        wsService.off('portfolio_update', handlePortfolioUpdate);
      };
    }
  }, [isLoggedIn, user, wsService, fetchPositions]);

  const handleTelegramLogin = () => {
    window.open("https://t.me/PerpMateBot", "_blank");
  };

  // Remove duplicated html/body/layout, just return content for layout.tsx to wrap
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Card className="bg-gray-800 border-gray-700 w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-brand">
              Login Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <p className="text-gray-300">
              Please log in to view your dashboard.
            </p>
            <Button
              onClick={handleTelegramLogin}
              variant="default"
              size="lg"
              className="flex w-full items-center gap-2 rounded-md bg-white hover:bg-white/90 text-gray-900 font-bold shadow-md transition-all duration-150 w"
            >
              <Image
                src="/assets/telegram-2.svg"
                alt="Telegram Logo"
                width={24}
                height={24}
                className="mr-1"
              />
              <span className="text-sm font-semibold">Login With Telegram</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <nav className="bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Image
                src="/assets/ghost.svg"
                alt="PerpMate Logo"
                width={40}
                height={40}
                className="mr-2 mb-1"
              />
              <Image
                src="/assets/PerpMate.svg"
                alt="PerpMate Logo"
                width={120}
                height={40}
              />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Header with status indicators */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold mb-2">Your Dashboard</h2>
              <div className="flex items-center space-x-4 text-sm text-gray-400">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span>{isConnected ? 'Live Updates' : 'Offline'}</span>
                </div>
                {lastUpdated && (
                  <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
                )}
              </div>
            </div>
            <Button onClick={fetchPositions} disabled={isLoading} className="flex items-center space-x-2">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>

          {/* Portfolio Analytics Cards */}
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">Total P&L</CardTitle>
                  <DollarSign className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${analytics.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ${analytics.totalPnl.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {analytics.averagePnlPercentage.toFixed(2)}% avg
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">Portfolio Value</CardTitle>
                  <BarChart3 className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    ${analytics.totalNotionalValue.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {analytics.positionCount} positions
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">Win Rate</CardTitle>
                  <Target className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {analytics.winRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {analytics.profitablePositions}/{analytics.positionCount} profitable
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">Activity</CardTitle>
                  <Activity className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-brand">
                    {isConnected ? <Zap className="inline w-6 h-6" /> : '-'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {isConnected ? 'Real-time' : 'Disconnected'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Positions Table */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-semibold text-brand">
                  Open Positions
                </CardTitle>
                {positions.length > 0 && (
                  <div className="text-sm text-gray-400">
                    {positions.length} active positions
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                  <p className="text-gray-400">Loading positions...</p>
                </div>
              ) : positions && positions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Asset
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Side
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Size
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Entry Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Mark Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          P&L
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          P&L %
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-gray-900 divide-y divide-gray-700">
                      {positions.map((pos) => (
                        <tr key={pos.asset} className="hover:bg-gray-700 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                            {pos.asset}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              pos.side === 'long' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                            }`}>
                              {pos.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {Math.abs(parseFloat(pos.szi)).toFixed(4)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            ${parseFloat(pos.entryPx).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            ${parseFloat(pos.markPx).toFixed(2)}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                            parseFloat(pos.unrealizedPnl) >= 0 ? "text-green-500" : "text-red-500"
                          }`}>
                            {parseFloat(pos.unrealizedPnl) >= 0 ? '+' : ''}${parseFloat(pos.unrealizedPnl).toFixed(2)}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                            pos.pnlPercentage >= 0 ? "text-green-500" : "text-red-500"
                          }`}>
                            {pos.pnlPercentage >= 0 ? '+' : ''}{pos.pnlPercentage.toFixed(2)}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            ${pos.notionalValue.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <PieChart className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg mb-2">No Open Positions</p>
                  <p className="text-gray-500 text-sm">Start trading on Hyperliquid via our Telegram bot to see your positions here!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
