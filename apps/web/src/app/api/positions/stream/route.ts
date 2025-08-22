import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Server-Sent Events endpoint for real-time position updates
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get("session");

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const sessionData = JSON.parse(session.value as string);
    const telegramId = sessionData.id;

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

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        controller.enqueue(`data: ${JSON.stringify({
          type: 'connected',
          timestamp: Date.now(),
          walletAddress: walletAddress
        })}\n\n`);

        // Set up periodic updates (every 5 seconds)
        const interval = setInterval(async () => {
          try {
            // Fetch fresh position data
            const response = await fetch(`${req.nextUrl.origin}/api/positions?refresh=true`);
            if (response.ok) {
              const data = await response.json();
              controller.enqueue(`data: ${JSON.stringify({
                type: 'position_update',
                timestamp: Date.now(),
                ...data
              })}\n\n`);
            }
          } catch (error) {
            controller.enqueue(`data: ${JSON.stringify({
              type: 'error',
              timestamp: Date.now(),
              message: 'Failed to fetch position update'
            })}\n\n`);
          }
        }, 5000);

        // Cleanup function
        const cleanup = () => {
          clearInterval(interval);
          controller.close();
        };

        // Handle client disconnect
        req.signal?.addEventListener('abort', cleanup);
        
        // Auto-cleanup after 5 minutes
        setTimeout(cleanup, 300000);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error) {
    console.error("SSE stream error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}