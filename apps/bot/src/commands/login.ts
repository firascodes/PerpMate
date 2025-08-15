import { CommandContext, Context } from "grammy";
import { prisma } from "../db/client";
import { nanoid } from "nanoid";

export async function handleLogin(ctx: CommandContext<Context>) {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    return ctx.reply("Could not identify user.");
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: String(telegramId) },
  });

  if (!user) {
    return ctx.reply(
      "You need to have a wallet first. Use /wallet to create one.",
    );
  }

  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await prisma.loginToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  const loginUrl = `${process.env.WEB_URL}/api/auth/verify?token=${token}`;

  await ctx.reply(
    `Click the button below to log in to the dashboard. This link is valid for 5 minutes.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Log in to Dashboard",
              url: loginUrl,
            },
          ],
        ],
      },
    },
  );
}
