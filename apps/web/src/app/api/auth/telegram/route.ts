import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const authData = Object.fromEntries(searchParams.entries());

  if (!BOT_TOKEN) {
    return NextResponse.json(
      { error: "Bot token not configured" },
      { status: 500 },
    );
  }

  try {
    const checkHash = authData.hash;
    delete authData.hash;

    const dataCheckString = Object.keys(authData)
      .sort()
      .map((key) => `${key}=${authData[key]}`)
      .join("\n");

    const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();
    const hmac = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (hmac !== checkHash) {
      return NextResponse.json(
        { error: "Invalid hash" },
        { status: 401 },
      );
    }
    
    // Auth successful, create a session
    const sessionData = {
      id: authData.id,
      first_name: authData.first_name,
      username: authData.username,
      photo_url: authData.photo_url,
      auth_date: authData.auth_date,
    };

    const cookieStore = await cookies();
    cookieStore.set("session", JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });

    // Redirect to the dashboard
    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (error) {
    console.error("Telegram auth error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
