import { Context } from 'grammy';

export async function handleHelp(ctx: Context) {
  await ctx.reply('Commands: /start, /wallet, /fund, /preview, /execute, /active');
}
