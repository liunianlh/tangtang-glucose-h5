import { PrismaClient } from '@prisma/client';
import { toLocalInputValue } from '../../src/lib/records.js';

function toApiBloodPressureRecord(record) {
  return {
    id: record.id,
    systolic: Number(record.systolic),
    diastolic: Number(record.diastolic),
    pulse: record.pulse ?? null,
    measuredAt: toLocalInputValue(record.measuredAt),
    note: record.note || ''
  };
}

export function createPrismaBloodPressureRecordRepository(prisma = new PrismaClient()) {
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

    async listBloodPressureRecords(userId) {
      const records = await prisma.bloodPressureRecord.findMany({
        where: { userId },
        orderBy: { measuredAt: 'desc' }
      });
      return records.map(toApiBloodPressureRecord);
    },

    async createBloodPressureRecord(userId, input) {
      await ensureUser(userId);
      const record = await prisma.bloodPressureRecord.create({
        data: {
          userId,
          systolic: input.systolic,
          diastolic: input.diastolic,
          pulse: input.pulse ?? null,
          measuredAt: new Date(input.measuredAt),
          note: input.note || ''
        }
      });
      return toApiBloodPressureRecord(record);
    },

    async updateBloodPressureRecord(userId, id, input) {
      const existing = await prisma.bloodPressureRecord.findFirst({
        where: { id, userId }
      });
      if (!existing) return null;

      const record = await prisma.bloodPressureRecord.update({
        where: { id },
        data: {
          systolic: input.systolic,
          diastolic: input.diastolic,
          pulse: input.pulse ?? null,
          measuredAt: new Date(input.measuredAt),
          note: input.note || ''
        }
      });
      return toApiBloodPressureRecord(record);
    },

    async deleteBloodPressureRecord(userId, id) {
      const existing = await prisma.bloodPressureRecord.findFirst({
        where: { id, userId }
      });
      if (!existing) return false;

      await prisma.bloodPressureRecord.delete({ where: { id } });
      return true;
    },

    async clearBloodPressureRecords(userId) {
      await prisma.bloodPressureRecord.deleteMany({ where: { userId } });
    }
  };
}
