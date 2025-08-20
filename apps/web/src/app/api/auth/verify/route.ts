import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token not provided" }, { status: 400 });
  }

  try {
    const loginToken = await prisma.loginToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!loginToken || loginToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    // Token is valid, create a session
    const sessionData = {
      id: loginToken.user.telegramId,
      first_name: loginToken.user.telegramId, // Placeholder, can be updated
      username: loginToken.user.telegramId, // Placeholder
    };

    // Create redirect response and set cookie on it (route handlers expose Response cookies)
    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.cookies.set("session", JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });

    // Delete the token to prevent reuse
    await prisma.loginToken.delete({ where: { id: loginToken.id } });

    // Return response with cookie
    return res;
  } catch (error) {
    console.error("Token verification error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
