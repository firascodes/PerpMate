import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";
import { InfoClient, HttpTransport } from "@nktkas/hyperliquid";
import { getGoldrushClient } from "@/lib/goldrush";

const prisma = new PrismaClient();

// Cache for position data to reduce API calls
const positionCache = new Map<string, { data: any; timestamp: number; analytics: any }>();
const CACHE_DURATION = 3000; // 3 seconds cache for more real-time feel

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

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get("session");

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const sessionData = JSON.parse(session.value as string);
    const telegramId = sessionData.id;

    // Get force refresh parameter
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const user = await prisma.user.findUnique({
      where: { telegramId: String(telegramId) },
    });

    if (!user || !user.evmWalletAddress) {
      return NextResponse.json(
        { error: "User or wallet not found" },
        { status: 404 },
      );
    }

    const walletAddress = user.evmWalletAddress as string;
    const cacheKey = `positions_${walletAddress}`;
    const now = Date.now();

    // Check cache first (unless force refresh)
    const cachedData = positionCache.get(cacheKey);
    if (!forceRefresh && cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
      return NextResponse.json({
        positions: cachedData.data,
        analytics: cachedData.analytics,
        cached: true,
        timestamp: cachedData.timestamp,
        walletAddress: walletAddress
      });
    }

    const info = new InfoClient({ transport: new HttpTransport() });
    const userState = await info.clearinghouseState({
      user: walletAddress as `0x${string}`,
    });
    
    const positions = userState.assetPositions || [];
    
    // Enhanced position processing with P&L calculations
    const enhancedPositions: EnhancedPosition[] = positions.map((pos: any) => {
      const szi = parseFloat(pos.szi);
      const entryPx = parseFloat(pos.entryPx);
      const markPx = parseFloat(pos.markPx);
      const unrealizedPnl = parseFloat(pos.unrealizedPnl);
      
      const notionalValue = Math.abs(szi) * markPx;
      const side = szi > 0 ? 'long' : 'short';
      const pnlPercentage = entryPx > 0 ? (unrealizedPnl / (Math.abs(szi) * entryPx)) * 100 : 0;
      
      return {
        asset: pos.asset,
        szi: pos.szi,
        entryPx: pos.entryPx,
        markPx: pos.markPx,
        unrealizedPnl: pos.unrealizedPnl,
        leverage: pos.leverage || "1",
        margin: pos.margin || "0",
        side,
        pnlPercentage,
        notionalValue,
        timestamp: now
      };
    });

    // Calculate portfolio analytics
    const totalPnl = enhancedPositions.reduce((sum, pos) => sum + parseFloat(pos.unrealizedPnl), 0);
    const totalNotionalValue = enhancedPositions.reduce((sum, pos) => sum + pos.notionalValue, 0);
    const positionCount = enhancedPositions.length;
    const profitablePositions = enhancedPositions.filter(pos => parseFloat(pos.unrealizedPnl) > 0).length;
    
    const analytics = {
      totalPnl,
      totalNotionalValue,
      positionCount,
      profitablePositions,
      winRate: positionCount > 0 ? (profitablePositions / positionCount) * 100 : 0,
      averagePnlPercentage: positionCount > 0 ? 
        enhancedPositions.reduce((sum, pos) => sum + pos.pnlPercentage, 0) / positionCount : 0,
      lastUpdated: now
    };

    // Try to get additional analytics from Goldrush (non-blocking)
    let goldrushAnalytics = null;
    try {
      const goldrush = getGoldrushClient();
      goldrushAnalytics = await Promise.race([
        goldrush.getEnhancedPositionAnalytics(walletAddress),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);
    } catch (goldrushError) {
      console.warn("Goldrush analytics failed:", goldrushError);
    }

    // Cache the results
    positionCache.set(cacheKey, {
      data: enhancedPositions,
      analytics: { ...analytics, goldrush: goldrushAnalytics },
      timestamp: now
    });

    return NextResponse.json({
      positions: enhancedPositions,
      analytics: { ...analytics, goldrush: goldrushAnalytics },
      cached: false,
      timestamp: now,
      walletAddress: walletAddress,
      performance: {
        apiCallDuration: now - Date.now(),
        cacheHit: false,
        positionsCount: enhancedPositions.length
      }
    });

  } catch (error) {
    console.error("Failed to fetch positions:", error);
    
    // Try to return cached data if available as fallback
    const walletAddress = (await prisma.user.findUnique({
      where: { telegramId: String(JSON.parse(session!.value as string).id) },
    }))?.evmWalletAddress as string;
    
    if (walletAddress) {
      const cachedData = positionCache.get(`positions_${walletAddress}`);
      if (cachedData) {
        return NextResponse.json({
          positions: cachedData.data,
          analytics: cachedData.analytics,
          cached: true,
          timestamp: cachedData.timestamp,
          walletAddress: walletAddress,
          fallback: true,
          error: "Live data unavailable, showing cached data"
        });
      }
    }
    
    return NextResponse.json(
      { 
        error: "Internal Server Error", 
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now()
      },
      { status: 500 },
    );
  }
}
