import { prisma } from './client';

export async function getUserByTelegramId(telegramId: string) {
  return prisma.user.findUnique({ where: { telegramId } });
}

export async function getAllUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      telegramId: true,
      evmWalletAddress: true,
      solanaWalletAddress: true,
      createdAt: true
    }
  });
}
