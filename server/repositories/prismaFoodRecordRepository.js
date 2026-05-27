import { PrismaClient } from '@prisma/client';
import { toLocalInputValue } from '../../src/lib/records.js';

function toApiFoodRecord(record) {
  return {
    id: record.id,
    mealType: record.mealType,
    eatenAt: toLocalInputValue(record.eatenAt),
    content: record.content,
    note: record.note || '',
    imageKey: record.imageKey || null,
    imageMime: record.imageMime || null,
    imageSize: record.imageSize || null
  };
}

export function createPrismaFoodRecordRepository(prisma = new PrismaClient()) {
  async function ensureUser(userId) {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: `${userId}@local.glucose`,
        name: '糖糖用户'
      },
      update: {}
    });
  }

  return {
    kind: 'mysql',

    async listFoodRecords(userId) {
      const records = await prisma.foodRecord.findMany({
        where: { userId },
        orderBy: { eatenAt: 'desc' }
      });
      return records.map(toApiFoodRecord);
    },

    async findFoodRecord(userId, id) {
      const record = await prisma.foodRecord.findFirst({
        where: { id, userId }
      });
      return record ? toApiFoodRecord(record) : null;
    },

    async findFoodRecordByImageKey(userId, imageKey) {
      const record = await prisma.foodRecord.findFirst({
        where: { userId, imageKey }
      });
      return record ? toApiFoodRecord(record) : null;
    },

    async createFoodRecord(userId, input) {
      await ensureUser(userId);
      const record = await prisma.foodRecord.create({
        data: {
          userId,
          mealType: input.mealType,
          eatenAt: new Date(input.eatenAt),
          content: input.content,
          note: input.note || '',
          imageKey: input.imageKey || null,
          imageMime: input.imageMime || null,
          imageSize: input.imageSize || null
        }
      });
      return toApiFoodRecord(record);
    },

    async updateFoodRecord(userId, id, input) {
      const existing = await prisma.foodRecord.findFirst({
        where: { id, userId }
      });
      if (!existing) return null;

      const record = await prisma.foodRecord.update({
        where: { id },
        data: {
          mealType: input.mealType,
          eatenAt: new Date(input.eatenAt),
          content: input.content,
          note: input.note || '',
          ...(input.imageKey === undefined ? {} : {
            imageKey: input.imageKey,
            imageMime: input.imageMime,
            imageSize: input.imageSize
          })
        }
      });
      return toApiFoodRecord(record);
    },

    async deleteFoodRecord(userId, id) {
      const existing = await prisma.foodRecord.findFirst({
        where: { id, userId }
      });
      if (!existing) return null;

      await prisma.foodRecord.delete({ where: { id } });
      return toApiFoodRecord(existing);
    },

    async clearFoodRecords(userId) {
      const existing = await prisma.foodRecord.findMany({
        where: { userId }
      });
      await prisma.foodRecord.deleteMany({ where: { userId } });
      return existing.map(toApiFoodRecord);
    }
  };
}
