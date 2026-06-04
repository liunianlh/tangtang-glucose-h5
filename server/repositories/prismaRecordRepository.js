import { PrismaClient } from '@prisma/client';
import { normalizeGlucoseValue, toLocalInputValue } from '../../src/lib/records.js';

function toApiRecord(record) {
  return {
    id: record.id,
    value: normalizeGlucoseValue(record.value),
    unit: record.unit,
    period: record.period,
    measuredAt: toLocalInputValue(record.measuredAt),
    note: record.note || ''
  };
}

export function createPrismaRecordRepository(prisma = new PrismaClient()) {
  async function ensureUser(userId) {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: `${userId}@local.glucose`,
        name: '我的老婆'
      },
      update: {}
    });
  }

  return {
    kind: 'mysql',

    async listRecords(userId) {
      const records = await prisma.glucoseRecord.findMany({
        where: { userId },
        orderBy: { measuredAt: 'desc' }
      });
      return records.map(toApiRecord);
    },

    async createRecord(userId, input) {
      await ensureUser(userId);
      const record = await prisma.glucoseRecord.create({
        data: {
          userId,
          value: normalizeGlucoseValue(input.value),
          unit: 'mmol/L',
          period: input.period,
          measuredAt: new Date(input.measuredAt),
          note: input.note || ''
        }
      });
      return toApiRecord(record);
    },

    async updateRecord(userId, id, input) {
      const existing = await prisma.glucoseRecord.findFirst({
        where: { id, userId }
      });
      if (!existing) return null;

      const record = await prisma.glucoseRecord.update({
        where: { id },
        data: {
          value: normalizeGlucoseValue(input.value),
          period: input.period,
          measuredAt: new Date(input.measuredAt),
          note: input.note || ''
        }
      });
      return toApiRecord(record);
    },

    async deleteRecord(userId, id) {
      const existing = await prisma.glucoseRecord.findFirst({
        where: { id, userId }
      });
      if (!existing) return false;

      await prisma.glucoseRecord.delete({ where: { id } });
      return true;
    },

    async clearRecords(userId) {
      await prisma.glucoseRecord.deleteMany({ where: { userId } });
    }
  };
}
