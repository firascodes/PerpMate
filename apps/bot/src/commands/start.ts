import { Context } from 'grammy';

export async function handleStart(ctx: Context) {
  await ctx.reply(
    'Welcome to PerpMate! This bot will help you fund and trade perps on Hyperliquid. Use /wallet to set up your embedded wallet.'
  );
}
