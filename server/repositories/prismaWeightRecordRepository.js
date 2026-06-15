import { PrismaClient } from '@prisma/client';
import { normalizeWeightValue, toLocalInputValue } from '../../src/lib/records.js';

function toApiWeightRecord(record) {
  return {
    id: record.id,
    weight: normalizeWeightValue(record.weight),
    measuredAt: toLocalInputValue(record.measuredAt),
    note: record.note || ''
  };
}

export function createPrismaWeightRecordRepository(prisma = new PrismaClient()) {
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

    async listWeightRecords(userId) {
      const records = await prisma.weightRecord.findMany({
        where: { userId },
        orderBy: { measuredAt: 'desc' }
      });
      return records.map(toApiWeightRecord);
    },

    async createWeightRecord(userId, input) {
      await ensureUser(userId);
      const record = await prisma.weightRecord.create({
        data: {
          userId,
          weight: normalizeWeightValue(input.weight),
          measuredAt: new Date(input.measuredAt),
          note: input.note || ''
        }
      });
      return toApiWeightRecord(record);
    },

    async updateWeightRecord(userId, id, input) {
      const existing = await prisma.weightRecord.findFirst({
        where: { id, userId }
      });
      if (!existing) return null;

      const record = await prisma.weightRecord.update({
        where: { id },
        data: {
          weight: normalizeWeightValue(input.weight),
          measuredAt: new Date(input.measuredAt),
          note: input.note || ''
        }
      });
      return toApiWeightRecord(record);
    },

    async deleteWeightRecord(userId, id) {
      const existing = await prisma.weightRecord.findFirst({
        where: { id, userId }
      });
      if (!existing) return false;

      await prisma.weightRecord.delete({ where: { id } });
      return true;
    },

    async clearWeightRecords(userId) {
      await prisma.weightRecord.deleteMany({ where: { userId } });
    }
  };
}
