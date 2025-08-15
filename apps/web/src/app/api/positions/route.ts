import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";
import { InfoClient, HttpTransport } from "@nktkas/hyperliquid";

const prisma = new PrismaClient();

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

    if (!user || !user.walletAddress) {
      return NextResponse.json(
        { error: "User or wallet not found" },
        { status: 404 },
      );
    }

    const info = new InfoClient({ transport: new HttpTransport() });
    const userState = await info.userState(user.walletAddress);
    const positions = userState.assetPositions;

    return NextResponse.json({ positions });
  } catch (error) {
    console.error("Failed to fetch positions:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
